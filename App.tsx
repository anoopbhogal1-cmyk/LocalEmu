import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Gamepad2, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { StatusBanner } from "@/components/StatusBanner";
import { Dropzone } from "@/components/Dropzone";
import { VaultPanel } from "@/components/VaultPanel";
import { EmulatorView } from "@/components/EmulatorView";
import { AccountModal } from "@/components/AccountModal";
import { AccessDatabase } from "@/components/AccessDatabase";
import { Eyebrow, Reveal } from "@/components/ui";
import { useVault, type VaultRom } from "@/hooks/useVault";
import {
  bootEmulator,
  captureAccountSaveSnapshot,
  loadAccountSaveSnapshot,
  teardownEmulator,
} from "@/lib/emulator";
import { downloadBlob, buildVaultBackup, readVaultBackup } from "@/lib/backup";
import {
  ACCEPT_ATTR,
  CORE_INFO,
  RomError,
  formatBytes,
  prepareRom,
  type ConsoleChoice,
  type RomBundle,
} from "@/lib/rom";
import { ASPECT_MODES, type ActiveSession, type EmulatorPhase, type StatusMessage } from "@/types";
import type { AccountSaveRecord, SaveSlotId, UserRecord } from "@/lib/db";

export default function App() {
  const vault = useVault();
  const {
    user,
    roms,
    saves,
    accounts,
    logins,
    snapshot,
    totals,
    dbError,
    signIn,
    register,
    signOut,
    storeRom,
    removeRom,
    storeAccountSave,
    removeAccountSave,
    removeAccount,
    wipeLog,
    refresh,
  } = vault;

  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [consoleChoice, setConsoleChoice] = useState<ConsoleChoice>("auto");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [phase, setPhase] = useState<EmulatorPhase>("booting");
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [bootNonce, setBootNonce] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authSeed, setAuthSeed] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [lastBoot, setLastBoot] = useState<string | null>(null);

  const screenRef = useRef<HTMLDivElement>(null);
  const romInputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  /** Queued account save to auto-restore once the core finishes booting. */
  const pendingResumeSave = useRef<AccountSaveRecord | null>(null);
  /** The boot effect reads the session through this ref so that vault writes
   *  (which change `session.id`) never restart an already-running core. */
  const sessionRef = useRef<ActiveSession | null>(null);

  const applySession = useCallback((next: ActiveSession | null, reboot = false) => {
    sessionRef.current = next;
    setSession(next);
    if (reboot) setBootNonce((nonce) => nonce + 1);
  }, []);

  const notify = useCallback((message: StatusMessage, sticky = false) => {
    window.clearTimeout(statusTimer.current);
    setStatus(message);
    if (!sticky && !message.busy) {
      statusTimer.current = window.setTimeout(() => setStatus(null), 9000);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  /* ---------------------------- emulator boot ---------------------------- */

  const bootToken = session ? bootNonce : 0;

  useEffect(() => {
    const active = sessionRef.current;
    if (!active || !screenRef.current) return;
    const url = URL.createObjectURL(active.romBlob);
    setPhase("booting");
    setCoreError(null);

    const teardown = bootEmulator(
      screenRef.current,
      {
        gameUrl: url,
        core: active.core,
        title: active.title,
        ownerKey: user?.usernameLower ?? "guest",
      },
      {
        onReady: () => {
          setPhase("ready");
          const queued = pendingResumeSave.current;
          if (queued) {
            pendingResumeSave.current = null;
            window.setTimeout(() => {
              void loadAccountSaveSnapshot(queued.stateBlob)
                .then(() =>
                  notify({
                    text: `Restored ${queued.label} from @${queued.ownerDisplay}'s account!`,
                    tone: "success",
                  }),
                )
                .catch(() =>
                  notify({
                    text: "Game booted — click Load on the Save button to restore your slot.",
                    tone: "info",
                  }),
                );
            }, 260);
          }
        },
        onError: (message) => {
          setPhase("error");
          setCoreError(message);
        },
        onSave: (kind) =>
          notify({
            text:
              kind === "sram"
                ? "In-game SRAM synced — use Save to @account anytime for instant slot snapshots."
                : "Emulator state captured.",
            tone: "success",
          }),
      },
    );

    return () => {
      teardown();
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootToken]);

  /* ------------------------------ launching ------------------------------ */

  const startSession = useCallback(
    async (
      bundle: RomBundle,
      source: { fromVault?: boolean; id?: string; trail?: string; resumeSave?: AccountSaveRecord } = {},
    ) => {
      const ownerKey = user?.usernameLower ?? "guest";
      const id = bundle.title
        ? `${ownerKey}::${bundle.core}::${bundle.title}`
        : `${ownerKey}::${bundle.core}`;
      const next: ActiveSession = {
        id,
        title: bundle.title,
        core: bundle.core,
        coreName: bundle.coreName,
        engine: bundle.engine,
        ratio: bundle.ratio,
        romBlob: bundle.romBlob,
        romFilename: bundle.romFilename,
        sourceTrail: source.trail ?? bundle.sourceTrail,
        sizeBytes: bundle.romBlob.size,
        isSavedInVault: Boolean(source.fromVault),
        startedAt: Date.now(),
      };

      pendingResumeSave.current = source.resumeSave ?? null;

      setBootLog([
        `mount ${bundle.romFilename} (${formatBytes(bundle.romBlob.size)})`,
        `identify core → ${bundle.core} · ${bundle.engine}`,
        `bind keys → J = OK (A) · K = Back (B)`,
        user ? `account scope → @${user.username}` : `guest mode → memory only`,
      ]);
      setAspectIdx(0);
      setLastBoot(next.title);
      applySession(next, true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      if (user && !source.fromVault) {
        try {
          await storeRom({
            id,
            owner: user.usernameLower,
            title: bundle.title,
            core: bundle.core,
            coreName: bundle.coreName,
            engine: bundle.engine,
            ratio: bundle.ratio,
            romBlob: bundle.romBlob,
            romFilename: bundle.romFilename,
            sizeBytes: bundle.romBlob.size,
            savedAt: Date.now(),
            lastPlayed: Date.now(),
            playCount: 1,
          });
          next.isSavedInVault = true;
          applySession({ ...next });
          notify({
            text: `Saved “${bundle.title}” to @${user.username}'s vault — booting ${bundle.coreName}.`,
            tone: "success",
          });
        } catch {
          notify({
            text: `Playing “${bundle.title}”. The vault write failed — storage may be full.`,
            tone: "warning",
          });
        }
      } else if (user) {
        const existingSave =
          !source.resumeSave && saves.find((item) => item.romId === id);
        if (existingSave) {
          notify({
            text: `Launching “${bundle.title}” — save found in @${user.username}'s account.`,
            tone: "success",
            action: {
              label: "Resume Save",
              onTrigger: () => {
                void loadAccountSaveSnapshot(existingSave.stateBlob)
                  .then(() =>
                    notify({
                      text: `Restored ${existingSave.label} from @${user.username}'s account!`,
                      tone: "success",
                    }),
                  )
                  .catch((err) =>
                    notify({
                      text: err instanceof Error ? err.message : "Wait for boot to finish first.",
                      tone: "warning",
                    }),
                  );
              },
            },
          });
        } else {
          notify({ text: `Launching “${bundle.title}” from @${user.username}'s vault.`, tone: "success" });
        }
      } else {
        notify(
          {
            text: `Booting “${bundle.title}” in guest mode — sign in to save ROMs & game states to your account.`,
            tone: "info",
            action: { label: "Sign in to save", onTrigger: () => openAuth("register") },
          },
          true,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applySession, notify, saves, storeRom, user],
  );

  const launchFile = useCallback(
    async (file: File) => {
      pendingFile.current = file;
      const isZip = /\.zip$/i.test(file.name);
      notify({
        text: isZip ? `Unpacking “${file.name}” in memory…` : `Preparing “${file.name}”…`,
        tone: "info",
        busy: true,
      });
      try {
        const bundle = await prepareRom(file, consoleChoice);
        window.clearTimeout(statusTimer.current);
        setStatus(null);
        await startSession(bundle);
      } catch (error) {
        const romError = error instanceof RomError ? error : null;
        const text =
          romError?.message ??
          (error instanceof Error ? error.message : "That file could not be read.");
        notify({
          text:
            romError?.kind === "unsupported"
              ? text
              : `${text} Try forcing a core in the header selector.`,
          tone: romError?.kind === "unsupported" ? "warning" : "error",
        });
      }
    },
    [consoleChoice, notify, startSession],
  );

  const launchSavedRom = useCallback(
    async (rom: VaultRom, resumeSave?: AccountSaveRecord) => {
      const updated: VaultRom = {
        ...rom,
        lastPlayed: Date.now(),
        playCount: (rom.playCount ?? 0) + 1,
      };
      try {
        await storeRom(updated);
      } catch {
        /* still playable */
      }
      await startSession(
        {
          title: rom.title,
          core: rom.core as RomBundle["core"],
          coreName: rom.coreName,
          engine: rom.engine,
          ratio: rom.ratio,
          romBlob: rom.romBlob,
          romFilename: rom.romFilename,
          sourceTrail: `vault · ${rom.romFilename}`,
        },
        { fromVault: true, id: rom.id, trail: `vault · ${rom.romFilename}`, resumeSave },
      );
    },
    [startSession, storeRom],
  );

  /* ----------------------- per-account game saves ------------------------ */

  const savesForActiveGame = useMemo(() => {
    if (!session || !user) return [];
    const romId = `${user.usernameLower}::${session.core}::${session.title}`;
    return saves.filter((item) => item.romId === romId);
  }, [saves, session, user]);

  const handleSaveAccountSlot = useCallback(
    async (slot: SaveSlotId, label: string) => {
      if (!session) return;
      if (!user) {
        openAuth("register");
        return;
      }
      try {
        const snap = await captureAccountSaveSnapshot();
        const romId = `${user.usernameLower}::${session.core}::${session.title}`;

        // Ensure the cartridge itself is also stored in this user's vault
        if (!session.isSavedInVault) {
          await storeRom({
            id: romId,
            owner: user.usernameLower,
            title: session.title,
            core: session.core,
            coreName: session.coreName,
            engine: session.engine,
            ratio: session.ratio,
            romBlob: session.romBlob,
            romFilename: session.romFilename,
            sizeBytes: session.sizeBytes,
            savedAt: Date.now(),
            lastPlayed: Date.now(),
            playCount: 1,
          });
          applySession({ ...session, id: romId, isSavedInVault: true });
        }

        const record: AccountSaveRecord = {
          id: `${romId}::${slot}`,
          owner: user.usernameLower,
          ownerDisplay: user.username,
          romId,
          title: session.title,
          core: session.core,
          slot,
          label,
          stateBlob: snap.stateBlob,
          sramBlob: snap.sramBlob,
          screenshotDataUrl: snap.screenshotDataUrl,
          sizeBytes: snap.sizeBytes,
          savedAt: Date.now(),
        };
        await storeAccountSave(record);
        notify({
          text: `Saved ${label} into @${user.username}'s account (${formatBytes(snap.sizeBytes)}).`,
          tone: "success",
        });
      } catch (error) {
        notify({
          text: error instanceof Error ? error.message : "Could not capture game state yet.",
          tone: "error",
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applySession, notify, session, storeAccountSave, storeRom, user],
  );

  const handleLoadAccountSave = useCallback(
    async (record: AccountSaveRecord) => {
      try {
        await loadAccountSaveSnapshot(record.stateBlob);
        notify({
          text: `Loaded ${record.label} from @${record.ownerDisplay}'s account!`,
          tone: "success",
        });
      } catch (error) {
        notify({
          text: error instanceof Error ? error.message : "Could not load that save state.",
          tone: "error",
        });
      }
    },
    [notify],
  );

  const handleDeleteAccountSave = useCallback(
    async (record: AccountSaveRecord) => {
      await removeAccountSave(record.id);
      notify({
        text: `Removed ${record.label} from @${record.ownerDisplay}'s account.`,
        tone: "info",
      });
    },
    [notify, removeAccountSave],
  );

  /* --------------------------- vault operations -------------------------- */

  const saveCurrentToVault = useCallback(async () => {
    if (!session) return;
    if (!user) {
      openAuth("register");
      return;
    }
    if (session.isSavedInVault) {
      notify({ text: `“${session.title}” is already in @${user.username}'s vault.`, tone: "success" });
      return;
    }
    try {
      const romId = `${user.usernameLower}::${session.core}::${session.title}`;
      await storeRom({
        id: romId,
        owner: user.usernameLower,
        title: session.title,
        core: session.core,
        coreName: session.coreName,
        engine: session.engine,
        ratio: session.ratio,
        romBlob: session.romBlob,
        romFilename: session.romFilename,
        sizeBytes: session.sizeBytes,
        savedAt: Date.now(),
        lastPlayed: Date.now(),
        playCount: 1,
      });
      applySession({ ...session, id: romId, isSavedInVault: true });
      notify({ text: `Filed “${session.title}” into @${user.username}'s vault.`, tone: "success" });
    } catch {
      notify({ text: "Could not write that ROM to IndexedDB.", tone: "error" });
    }
  }, [applySession, notify, session, storeRom, user]);

  const backupVault = useCallback(async () => {
    if (!user || roms.length === 0) return;
    notify({ text: `Packing ${roms.length} cartridges…`, tone: "info", busy: true });
    try {
      const blob = await buildVaultBackup(roms, user.username);
      downloadBlob(blob, `LocalEmu_Vault_${user.username}.zip`);
      notify({ text: "Backup archive downloaded — ROMs plus a restore manifest.", tone: "success" });
    } catch {
      notify({ text: "Backup failed.", tone: "error" });
    }
  }, [notify, roms, user]);

  const restoreVault = useCallback(
    async (file: File) => {
      if (!user) return;
      notify({ text: `Restoring ${file.name}…`, tone: "info", busy: true });
      try {
        const records = await readVaultBackup(file, user.usernameLower);
        for (const record of records) {
          await storeRom({
            ...record,
            id: `${user.usernameLower}::${record.core}::${record.title}`,
          });
        }
        await refresh();
        notify({
          text:
            records.length > 0
              ? `Restored ${records.length} ${records.length === 1 ? "cartridge" : "cartridges"} into @${user.username}'s vault.`
              : "No restorable ROMs found in that file.",
          tone: records.length > 0 ? "success" : "warning",
        });
      } catch (error) {
        notify({ text: error instanceof Error ? error.message : "Restore failed.", tone: "error" });
      }
    },
    [notify, refresh, storeRom, user],
  );

  const saveStandaloneApp = useCallback(() => {
    try {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelector('[role="dialog"]')?.remove();
      clone.querySelector('[role="status"]')?.remove();
      clone.querySelectorAll("script[data-ejs-loader]").forEach((node) => node.remove());
      downloadBlob(
        new Blob([`<!DOCTYPE html>\n${clone.outerHTML}`], { type: "text/html;charset=utf-8" }),
        "LocalEmu.html",
      );
      notify({ text: "Saved LocalEmu.html — it runs offline from anywhere.", tone: "success" });
    } catch {
      notify({ text: "Your browser blocked the download — press Ctrl/Cmd+S instead.", tone: "warning" });
    }
  }, [notify]);

  /* -------------------------------- auth -------------------------------- */

  function openAuth(tab: "login" | "register" = "login", seed: string | null = null) {
    setAuthTab(tab);
    setAuthSeed(seed);
    setAuthError(null);
    setModalOpen(true);
  }

  const submitAuth = useCallback(
    async (username: string, password: string) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const account =
          authTab === "login" ? await signIn(username, password) : await register(username, password);
        if (session && !session.isSavedInVault) {
          const romId = `${account.usernameLower}::${session.core}::${session.title}`;
          await storeRom({
            id: romId,
            owner: account.usernameLower,
            title: session.title,
            core: session.core,
            coreName: session.coreName,
            engine: session.engine,
            ratio: session.ratio,
            romBlob: session.romBlob,
            romFilename: session.romFilename,
            sizeBytes: session.sizeBytes,
            savedAt: Date.now(),
            lastPlayed: Date.now(),
            playCount: 1,
          });
          applySession({ ...session, id: romId, isSavedInVault: true });
        }
        await refresh();
        setModalOpen(false);
        notify({
          text:
            authTab === "login"
              ? `Welcome back, @${account.username} — account saves & vault unlocked!`
              : `Account @${account.username} created — Save to @${account.username} is now unlocked!`,
          tone: "success",
        });
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession, authTab, notify, refresh, register, session, signIn, storeRom],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    setModalOpen(false);
    if (session) {
      teardownEmulator();
      applySession(null);
      notify({ text: "Signed out — the emulator was stopped and your account vault locked.", tone: "info" });
    } else {
      notify({ text: "Vault locked. Your cartridges & account saves remain safe in IndexedDB.", tone: "info" });
    }
  }, [applySession, notify, session, signOut]);

  /* ------------------------------ derived ------------------------------- */

  const aspectRatio = useMemo(() => {
    const mode = ASPECT_MODES[aspectIdx];
    return mode.value === "detected" ? (session?.ratio ?? "4/3") : mode.value;
  }, [aspectIdx, session]);

  const handleDeleteRom = useCallback(
    async (rom: VaultRom) => {
      await removeRom(rom.id);
      if (session?.id === rom.id) {
        teardownEmulator();
        applySession(null);
      }
      notify({ text: `Removed “${rom.title}” from the vault.`, tone: "info" });
    },
    [applySession, notify, removeRom, session],
  );

  const handleDeleteAccount = useCallback(
    async (account: UserRecord) => {
      await removeAccount(account.usernameLower);
      notify({ text: `Account @${account.username} and its vault records were deleted.`, tone: "warning" });
    },
    [notify, removeAccount],
  );

  const handleDownloadRom = useCallback(
    (rom: VaultRom) => {
      downloadBlob(rom.romBlob, rom.romFilename || `${rom.title}.${rom.core}`);
      notify({ text: `Exported ${rom.romFilename || rom.title} from your vault.`, tone: "success" });
    },
    [notify],
  );

  const onConsoleChange = useCallback(
    (value: ConsoleChoice) => {
      setConsoleChoice(value);
      if (pendingFile.current && !session) {
        void launchFile(pendingFile.current);
        return;
      }
      if (session && value !== "auto") {
        const info = CORE_INFO[value];
        const forced = {
          ...session,
          core: value,
          coreName: info.name,
          engine: info.engine,
          ratio: info.ratio,
        };
        applySession(forced, true);
        notify({
          text: `Forced the ${info.name} core (${info.engine}) onto the running cartridge.`,
          tone: "info",
        });
      }
    },
    [applySession, launchFile, notify, session],
  );

  const backToLibrary = useCallback(() => {
    teardownEmulator();
    applySession(null);
    setPhase("booting");
    setCoreError(null);
    setStatus(null);
    void refresh();
  }, [applySession, refresh]);

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* ambient room lighting */}
      <div className="pointer-events-none fixed inset-0 -z-10 room-ambient" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-plate opacity-70" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(600px_240px_at_50%_0%,rgba(77,243,255,0.10),transparent_70%)] animate-glow-breathe" />

      <Header
        consoleChoice={consoleChoice}
        onConsoleChange={onConsoleChange}
        user={user}
        gameCount={roms.length}
        saveCount={saves.length}
        onOpenAccount={() => openAuth(user ? "login" : accounts.length === 0 ? "register" : "login")}
        onSaveApp={saveStandaloneApp}
        activeConsole={session ? `${CORE_INFO[session.core].short} · ${session.engine}` : null}
        dbLabel={
          dbError
            ? "IndexedDB unavailable"
            : `${snapshot ? `${snapshot.name} v${snapshot.version}` : "opening db"} · ${accounts.length} account${accounts.length === 1 ? "" : "s"}`
        }
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-7 sm:py-8">
        <StatusBanner status={status} onDismiss={() => setStatus(null)} />

        {session ? (
          <EmulatorView
            session={session}
            phase={phase}
            bootLog={bootLog}
            screenRef={screenRef}
            aspectRatio={aspectRatio}
            aspectLabel={ASPECT_MODES[aspectIdx].label}
            user={user}
            savesForGame={savesForActiveGame}
            onSaveAccountSlot={handleSaveAccountSlot}
            onLoadAccountSave={handleLoadAccountSave}
            onDeleteAccountSave={handleDeleteAccountSave}
            onRequestSignIn={() => openAuth(accounts.length === 0 ? "register" : "login")}
            onCycleAspect={() => setAspectIdx((index) => (index + 1) % ASPECT_MODES.length)}
            onReset={() => setBootNonce((nonce) => nonce + 1)}
            onSaveToVault={saveCurrentToVault}
            onBackToLibrary={backToLibrary}
            onLoadAnother={() => romInputRef.current?.click()}
            controlsOpen={controlsOpen}
            onToggleControls={() => setControlsOpen((open) => !open)}
            errorMessage={coreError}
          />
        ) : (
          <Reveal>
            <Dropzone
              onFile={(file) => void launchFile(file)}
              romCount={roms.length}
              saveCount={saves.length}
              bytesUsed={totals.bytes}
              lastBoot={lastBoot}
              signedIn={Boolean(user)}
            />
          </Reveal>
        )}

        <Reveal delay={90}>
          <VaultPanel
            user={user}
            roms={roms}
            saves={saves}
            activeId={session?.id ?? null}
            onPlay={(rom) => void launchSavedRom(rom)}
            onResumeSave={(rom, save) => void launchSavedRom(rom, save)}
            onDownload={handleDownloadRom}
            onDelete={(rom) => void handleDeleteRom(rom)}
            onOpenAccount={() => openAuth(accounts.length === 0 ? "register" : "login")}
            onBackup={() => void backupVault()}
            onRestore={(file) => void restoreVault(file)}
          />
        </Reveal>

        <Reveal delay={140}>
          <AccessDatabase
            snapshot={snapshot}
            accounts={accounts}
            logins={logins}
            dbError={dbError}
            user={user}
            onWipeLog={() => {
              void wipeLog();
              notify({ text: "Login access log cleared.", tone: "info" });
            }}
            onDeleteAccount={(account) => void handleDeleteAccount(account)}
            onOpenAccount={() => openAuth(accounts.length === 0 ? "register" : "login")}
          />
        </Reveal>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-5 pb-2">
          <Eyebrow className="flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-crt-400" />
            files, accounts and saves stay on this device — nothing is uploaded
          </Eyebrow>
          <div className="flex items-center gap-2.5">
            <Eyebrow className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-ember-400" /> {Object.keys(CORE_INFO).length} cores
            </Eyebrow>
            <Eyebrow className="hidden items-center gap-1.5 sm:flex">
              <Gamepad2 className="h-3 w-3 text-ember-400" /> J = OK · K = Back
            </Eyebrow>
          </div>
        </footer>
      </main>

      <input
        ref={romInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void launchFile(file);
          event.target.value = "";
        }}
      />

      <AccountModal
        open={modalOpen}
        tab={authTab}
        onTab={setAuthTab}
        user={user}
        accounts={accounts}
        romCount={roms.length}
        bytesUsed={totals.bytes}
        logins={logins}
        error={authError}
        submitting={authBusy}
        usernameSeed={authSeed}
        onSubmit={(username, password) => void submitAuth(username, password)}
        onClose={() => setModalOpen(false)}
        onSignOut={() => void handleSignOut()}
        onPickAccount={(username) => {
          setAuthTab("login");
          setAuthSeed(username);
        }}
      />
    </div>
  );
}
