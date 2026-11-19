import { useRef } from "react";
import {
  Download,
  FolderUp,
  HardDriveDownload,
  Library,
  Lock,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { Button, Chip, Eyebrow, Led, Panel, Reveal } from "@/components/ui";
import { formatBytes, formatRelative } from "@/lib/rom";
import type { VaultRom } from "@/hooks/useVault";
import type { PublicUser } from "@/lib/auth";
import type { AccountSaveRecord } from "@/lib/db";
import { cn } from "@/utils/cn";

/** Deterministic cartridge label art so each game is visually distinct. */
function cartridgeStyle(title: string): { background: string; hue: number } {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const second = (hue + 48) % 360;
  return {
    hue,
    background: `linear-gradient(140deg, hsl(${hue} 62% 26%) 0%, hsl(${second} 70% 14%) 58%, #0c0e12 100%)`,
  };
}

export function VaultPanel({
  user,
  roms,
  saves,
  onPlay,
  onResumeSave,
  onDownload,
  onDelete,
  onOpenAccount,
  onBackup,
  onRestore,
  activeId,
}: {
  user: PublicUser | null;
  roms: VaultRom[];
  saves: AccountSaveRecord[];
  onPlay: (rom: VaultRom) => void;
  onResumeSave: (rom: VaultRom, save: AccountSaveRecord) => void;
  onDownload: (rom: VaultRom) => void;
  onDelete: (rom: VaultRom) => void;
  onOpenAccount: () => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
  activeId: string | null;
}) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const totalBytes =
    roms.reduce((sum, rom) => sum + rom.sizeBytes, 0) +
    saves.reduce((sum, save) => sum + save.sizeBytes, 0);

  return (
    <Panel className="overflow-hidden">
      {/* Panel head */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/7 px-5 py-5 sm:px-7">
        <div className="min-w-0">
          <Eyebrow>saved library &amp; account states</Eyebrow>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-2xl leading-none font-bold tracking-tight text-vellum">
              My Game Vault
            </h2>
            <Chip tone={user ? "ember" : "neutral"} className="normal-case">
              {user ? (
                <>
                  <Led tone="crt" className="h-1.5 w-1.5" />@{user.username}
                </>
              ) : (
                "guest mode"
              )}
            </Chip>
          </div>
          <p className="mt-2 font-mono text-[11px] text-ash-500">
            {user
              ? `${roms.length} ${roms.length === 1 ? "cartridge" : "cartridges"} · ${saves.length} account ${saves.length === 1 ? "save" : "saves"} · ${formatBytes(totalBytes)} in IndexedDB`
              : "Sign in with a local account to persist ROMs and game saves in this browser's IndexedDB."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!user ? (
            <Button
              variant="primary"
              icon={<Lock className="h-3.5 w-3.5" />}
              onClick={onOpenAccount}
            >
              Create account / sign in
            </Button>
          ) : (
            <>
              <Button
                variant="quiet"
                icon={<Save className="h-3.5 w-3.5 text-ember-400" />}
                onClick={onBackup}
                disabled={roms.length === 0}
                title="Download a .zip backup of every saved ROM"
              >
                Backup vault
              </Button>
              <Button
                variant="quiet"
                icon={<FolderUp className="h-3.5 w-3.5 text-crt-400" />}
                onClick={() => restoreRef.current?.click()}
                title="Restore ROMs from a LocalEmu backup"
              >
                Restore
              </Button>
              <input
                ref={restoreRef}
                type="file"
                accept=".zip,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onRestore(file);
                  event.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Guest prompt */}
      {!user ? (
        <div className="m-5 flex flex-col items-start justify-between gap-5 rounded-3xl border border-ember-400/20 bg-cabinet-950/70 p-5 sm:m-7 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ember-400/25 bg-ember-500/10">
              <Lock className="h-5 w-5 text-ember-400" />
            </div>
            <div>
              <h3 className="font-display text-[17px] font-bold text-vellum">
                Unlock persistent ROMs &amp; private account saves
              </h3>
              <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-ash-400">
                Accounts are salted + SHA-256 hashed inside this browser. Every cartridge you drop
                and every <strong className="font-semibold text-cyan-300">Save to @account</strong>{" "}
                snapshot is stored under your username so you can hit{" "}
                <strong className="font-semibold text-ember-300">Resume</strong> anytime on desktop,
                mobile, or iPad.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onOpenAccount} className="shrink-0">
            Create account →
          </Button>
        </div>
      ) : null}

      {/* Empty state */}
      {user && roms.length === 0 ? (
        <div className="px-6 py-12 text-center sm:px-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/12 text-ash-500">
            <Library className="h-6 w-6" />
          </div>
          <p className="mt-4 font-display text-base font-bold text-ash-200">
            Your vault is empty — and waiting
          </p>
          <p className="mt-1 text-xs text-ash-500">
            Drop or select any <code className="font-mono text-ember-300">.zip</code> or ROM above:
            it boots instantly and saves itself here.
          </p>
        </div>
      ) : null}

      {/* Grid */}
      {roms.length > 0 ? (
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-3">
          {roms.map((rom, index) => {
            const art = cartridgeStyle(rom.title);
            const isActive = activeId === rom.id;
            const romSaves = saves.filter((save) => save.romId === rom.id);
            const latestSave = romSaves[0] ?? null;

            return (
              <Reveal key={rom.id} delay={Math.min(index * 55, 320)}>
                <article
                  className={cn(
                    "tile group flex h-full flex-col overflow-hidden rounded-2xl border bg-cabinet-900/70",
                    isActive
                      ? "border-ember-400/60 shadow-[0_0_0_1px_rgba(245,158,49,0.25),0_22px_50px_-24px_rgba(245,158,49,0.55)]"
                      : "border-white/8 hover:border-ember-400/45 hover:shadow-[0_26px_50px_-28px_rgba(0,0,0,0.95)]",
                  )}
                >
                  {/* Cartridge label (uses live save screenshot if available) */}
                  <div
                    className="relative h-28 overflow-hidden"
                    style={{ background: art.background }}
                  >
                    {latestSave?.screenshotDataUrl ? (
                      <img
                        src={latestSave.screenshotDataUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-0 scanlines opacity-35" />

                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {isActive ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 backdrop-blur-sm">
                          <Led tone="ember" className="h-1.5 w-1.5" />
                          <span className="font-mono text-[9px] tracking-widest text-ember-300 uppercase">
                            running
                          </span>
                        </div>
                      ) : null}
                      {romSaves.length > 0 ? (
                        <span className="rounded-full border border-cyan-400/40 bg-black/65 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-200 backdrop-blur-sm">
                          {romSaves.length} {romSaves.length === 1 ? "save" : "saves"}
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3.5">
                      <span
                        className="font-display text-[38px] leading-none font-bold text-white/90 mix-blend-overlay"
                        style={{ letterSpacing: "-0.04em" }}
                      >
                        {rom.title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "··"}
                      </span>
                      <Chip className="border-white/20 bg-black/55 text-white/90 backdrop-blur-sm">
                        {rom.core.toUpperCase()}
                      </Chip>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <h3 className="line-clamp-2 font-display text-[15px] leading-snug font-bold text-vellum transition-colors group-hover:text-ember-300">
                        {rom.title}
                      </h3>
                      <p className="mt-1.5 font-mono text-[10.5px] text-ash-500">
                        {rom.engine} · {formatBytes(rom.sizeBytes)} ·{" "}
                        {latestSave
                          ? `saved ${formatRelative(latestSave.savedAt)}`
                          : formatRelative(rom.lastPlayed || rom.savedAt)}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Play className="h-3.5 w-3.5 fill-current" />}
                        onClick={() => onPlay(rom)}
                        className="flex-1 py-2.5"
                      >
                        {isActive ? "Re-launch" : "Play"}
                      </Button>
                      {latestSave ? (
                        <Button
                          variant="success"
                          size="sm"
                          icon={<HardDriveDownload className="h-3.5 w-3.5" />}
                          onClick={() => onResumeSave(rom, latestSave)}
                          title={`Boot & restore ${latestSave.label} (${formatRelative(latestSave.savedAt)})`}
                          className="py-2.5"
                        >
                          Resume
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        title="Download ROM file"
                        onClick={() => onDownload(rom)}
                        className="cursor-pointer rounded-xl border border-white/8 bg-cabinet-850 p-2 text-ash-400 transition hover:border-crt-400/45 hover:text-crt-300"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Remove from vault"
                        onClick={() => onDelete(rom)}
                        className="cursor-pointer rounded-xl border border-white/8 bg-cabinet-850 p-2 text-ash-400 transition hover:border-berry-400/50 hover:text-berry-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
