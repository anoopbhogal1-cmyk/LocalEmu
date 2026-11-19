import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLoginLog,
  deleteAccountSave,
  deleteUser,
  deleteRom,
  getAccountSavesByOwner,
  getDatabaseSnapshot,
  getLoginLog,
  getRomsByOwner,
  openVaultDB,
  putAccountSave,
  saveRom,
  type AccountSaveRecord,
  type DatabaseSnapshot,
  type LoginLogEntry,
  type RomRecord,
  type UserRecord,
} from "@/lib/db";
import {
  createAccount,
  listAccounts,
  readStoredSession,
  signIn as authSignIn,
  signOut as authSignOut,
  writeStoredSession,
  type PublicUser,
} from "@/lib/auth";

export type VaultRom = RomRecord & { isSavedInVault: true };

/**
 * useVault — single source of truth for accounts, the saved-ROM library,
 * per-account game save states, and the credential access log.
 */
export function useVault() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [roms, setRoms] = useState<VaultRom[]>([]);
  const [saves, setSaves] = useState<AccountSaveRecord[]>([]);
  const [accounts, setAccounts] = useState<UserRecord[]>([]);
  const [logins, setLogins] = useState<LoginLogEntry[]>([]);
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async (owner?: string | null) => {
    const [nextRoms, nextSaves, nextAccounts, nextLogins, nextSnapshot] = await Promise.all([
      owner ? getRomsByOwner(owner) : Promise.resolve([]),
      owner ? getAccountSavesByOwner(owner) : Promise.resolve([]),
      listAccounts(),
      getLoginLog(40),
      getDatabaseSnapshot(),
    ]);
    setRoms(nextRoms.map((rom) => ({ ...rom, isSavedInVault: true as const })));
    setSaves(nextSaves);
    setAccounts(nextAccounts);
    setLogins(nextLogins);
    setSnapshot(nextSnapshot);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await openVaultDB();
        const session = readStoredSession();
        let activeOwner: string | null = null;
        if (session) {
          const existing = await listAccounts();
          const match = existing.find((account) => account.usernameLower === session.usernameLower);
          if (!match) {
            writeStoredSession(null);
          } else {
            activeOwner = match.usernameLower;
            if (!cancelled) setUser({ username: match.username, usernameLower: match.usernameLower });
          }
        }
        if (!cancelled) {
          setDbReady(true);
          await refresh(activeOwner);
        }
      } catch (error) {
        if (!cancelled) {
          setDbReady(true);
          setDbError(error instanceof Error ? error.message : "Local database unavailable.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const record = await authSignIn(username, password);
      const publicUser = { username: record.username, usernameLower: record.usernameLower };
      writeStoredSession(publicUser);
      setUser(publicUser);
      await refresh(publicUser.usernameLower);
      return publicUser;
    },
    [refresh],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const { user: record } = await createAccount(username, password);
      const publicUser = { username: record.username, usernameLower: record.usernameLower };
      writeStoredSession(publicUser);
      setUser(publicUser);
      await refresh(publicUser.usernameLower);
      return publicUser;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    await authSignOut(user);
    writeStoredSession(null);
    setUser(null);
    setRoms([]);
    setSaves([]);
    await refresh(null);
    busy.current = false;
  }, [refresh, user]);

  const storeRom = useCallback(
    async (rom: RomRecord) => {
      await saveRom(rom);
      if (user) await refresh(user.usernameLower);
      else await refresh(null);
    },
    [refresh, user],
  );

  const removeRom = useCallback(
    async (id: string) => {
      await deleteRom(id);
      await refresh(user?.usernameLower ?? null);
    },
    [refresh, user],
  );

  const storeAccountSave = useCallback(
    async (record: AccountSaveRecord) => {
      await putAccountSave(record);
      await refresh(record.owner);
    },
    [refresh],
  );

  const removeAccountSave = useCallback(
    async (id: string) => {
      await deleteAccountSave(id);
      await refresh(user?.usernameLower ?? null);
    },
    [refresh, user],
  );

  const removeAccount = useCallback(
    async (usernameLower: string) => {
      await deleteUser(usernameLower);
      const nextOwner = user?.usernameLower === usernameLower ? null : (user?.usernameLower ?? null);
      if (user?.usernameLower === usernameLower) {
        writeStoredSession(null);
        setUser(null);
        setRoms([]);
        setSaves([]);
      }
      await refresh(nextOwner);
    },
    [refresh, user],
  );

  const wipeLog = useCallback(async () => {
    await clearLoginLog();
    await refresh(user?.usernameLower ?? null);
  }, [refresh, user]);

  const totals = useMemo(() => {
    const romBytes = roms.reduce((sum, rom) => sum + (rom.sizeBytes || 0), 0);
    const saveBytes = saves.reduce((sum, save) => sum + (save.sizeBytes || 0), 0);
    const plays = roms.reduce((sum, rom) => sum + (rom.playCount ?? 0), 0);
    const cores = new Set(roms.map((rom) => rom.core));
    return {
      count: roms.length,
      bytes: romBytes + saveBytes,
      romBytes,
      saveBytes,
      saveCount: saves.length,
      plays,
      cores: cores.size,
    };
  }, [roms, saves]);

  return {
    dbReady,
    dbError,
    user,
    roms,
    saves,
    accounts,
    logins,
    snapshot,
    totals,
    signIn,
    register,
    signOut,
    storeRom,
    removeRom,
    storeAccountSave,
    removeAccountSave,
    removeAccount,
    wipeLog,
    refresh: () => refresh(user?.usernameLower ?? null),
  };
}
