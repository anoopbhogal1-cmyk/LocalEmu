/**
 * db.ts — LocalEmu persistence layer.
 *
 * Everything lives in the browser: one IndexedDB database (`LocalEmuVaultDB`)
 * with four object stores:
 *
 *   • users   — local accounts (username, salt, SHA-256 hash, login counters)
 *   • roms    — the saved game vault, indexed by owner
 *   • saves   — per-account emulator save states & SRAM snapshots, indexed by owner + romId
 *   • logins  — the credential access log (who signed in, when, from where)
 *
 * Plaintext passwords are never written to disk; only a per-user random salt
 * plus the derived SHA-256 digest is stored.
 */

export const DB_NAME = "LocalEmuVaultDB";
export const DB_VERSION = 3;
export const OBJECT_STORES = ["users", "roms", "saves", "logins"] as const;
export type ObjectStoreName = (typeof OBJECT_STORES)[number];

export type UserRecord = {
  /** primary key — lower-cased username */
  usernameLower: string;
  username: string;
  salt: string;
  passwordHash: string;
  hashAlgo: "SHA-256";
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  loginCount: number;
};

export type LoginStatus = "success" | "failed";
export type LoginAction = "signed-in" | "signed-out" | "account-created" | "attempt";

export type LoginLogEntry = {
  id: string;
  username: string;
  usernameLower: string;
  action: LoginAction;
  status: LoginStatus;
  detail?: string;
  at: number;
  device: string;
};

export type RomRecord = {
  /** `${owner}::${core}::${title}` */
  id: string;
  owner: string;
  title: string;
  core: string;
  coreName: string;
  engine: string;
  ratio: string;
  romBlob: Blob;
  romFilename: string;
  sizeBytes: number;
  savedAt: number;
  lastPlayed: number;
  playCount?: number;
};

export type SaveSlotId = "quick" | "slot-1" | "slot-2" | "slot-3";

export type AccountSaveRecord = {
  /** `${owner}::${core}::${title}::${slot}` */
  id: string;
  /** lower-cased username owning this save */
  owner: string;
  ownerDisplay: string;
  /** `${owner}::${core}::${title}` */
  romId: string;
  title: string;
  core: string;
  slot: SaveSlotId;
  label: string;
  stateBlob: Blob;
  sramBlob: Blob | null;
  screenshotDataUrl: string | null;
  sizeBytes: number;
  savedAt: number;
};

export type DatabaseSnapshot = {
  name: string;
  version: number;
  stores: ObjectStoreName[];
  counts: Record<ObjectStoreName, number>;
  usageBytes: number;
  quotaBytes: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

/** Open (and lazily migrate) the vault database. Safe to call repeatedly. */
export function openVaultDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "usernameLower" });
      }
      if (!db.objectStoreNames.contains("roms")) {
        const roms = db.createObjectStore("roms", { keyPath: "id" });
        roms.createIndex("owner", "owner", { unique: false });
      }
      if (!db.objectStoreNames.contains("saves")) {
        const saves = db.createObjectStore("saves", { keyPath: "id" });
        saves.createIndex("owner", "owner", { unique: false });
        saves.createIndex("romId", "romId", { unique: false });
      }
      if (!db.objectStoreNames.contains("logins")) {
        const logins = db.createObjectStore("logins", { keyPath: "id" });
        logins.createIndex("usernameLower", "usernameLower", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed to open."));
    request.onblocked = () =>
      reject(new Error("IndexedDB is blocked — close other LocalEmu tabs and reload."));
  });
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function run<T>(
  store: ObjectStoreName,
  mode: IDBTransactionMode,
  executor: (objectStore: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openVaultDB();
  const tx = db.transaction(store, mode);
  const result = await executor(tx.objectStore(store));
  if (mode !== "readonly") {
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Transaction failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted."));
    });
  }
  return result;
}

/* ------------------------------ users ------------------------------ */

export function getAllUsers(): Promise<UserRecord[]> {
  return run("users", "readonly", (s) => wrap<UserRecord[]>(s.getAll() as IDBRequest<UserRecord[]>));
}

export function getUser(usernameLower: string): Promise<UserRecord | undefined> {
  return run("users", "readonly", (s) => wrap<UserRecord | undefined>(s.get(usernameLower)));
}

export function putUser(user: UserRecord): Promise<void> {
  return run("users", "readwrite", (s) => {
    s.put(user);
  });
}

export async function deleteUser(usernameLower: string): Promise<void> {
  await run("users", "readwrite", (s) => {
    s.delete(usernameLower);
  });
  for (const rom of await getRomsByOwner(usernameLower)) {
    await deleteRom(rom.id);
  }
  for (const save of await getAccountSavesByOwner(usernameLower)) {
    await deleteAccountSave(save.id);
  }
  await clearLoginLog(usernameLower);
}

/* ------------------------------ roms ------------------------------- */

export async function getRomsByOwner(owner: string): Promise<RomRecord[]> {
  const list = await run("roms", "readonly", (s) =>
    wrap<RomRecord[]>(s.index("owner").getAll(owner) as IDBRequest<RomRecord[]>),
  );
  return list.sort((a, b) => (b.lastPlayed || b.savedAt || 0) - (a.lastPlayed || a.savedAt || 0));
}

export function saveRom(rom: RomRecord): Promise<void> {
  return run("roms", "readwrite", (s) => {
    s.put(rom);
  });
}

export function deleteRom(id: string): Promise<void> {
  return run("roms", "readwrite", (s) => {
    s.delete(id);
  });
}

/* ------------------------------ saves ------------------------------ */

export async function getAccountSavesByOwner(owner: string): Promise<AccountSaveRecord[]> {
  const list = await run("saves", "readonly", (s) =>
    wrap<AccountSaveRecord[]>(s.index("owner").getAll(owner) as IDBRequest<AccountSaveRecord[]>),
  );
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getAccountSavesForRom(romId: string): Promise<AccountSaveRecord[]> {
  const list = await run("saves", "readonly", (s) =>
    wrap<AccountSaveRecord[]>(s.index("romId").getAll(romId) as IDBRequest<AccountSaveRecord[]>),
  );
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

export function putAccountSave(record: AccountSaveRecord): Promise<void> {
  return run("saves", "readwrite", (s) => {
    s.put(record);
  });
}

export function deleteAccountSave(id: string): Promise<void> {
  return run("saves", "readwrite", (s) => {
    s.delete(id);
  });
}

/* ----------------------------- logins ------------------------------ */

export async function appendLoginLog(
  entry: Omit<LoginLogEntry, "id" | "at" | "device"> & { at?: number },
): Promise<LoginLogEntry> {
  const record: LoginLogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? Date.now(),
    device: describeDevice(),
    username: entry.username,
    usernameLower: entry.usernameLower,
    action: entry.action,
    status: entry.status,
    detail: entry.detail,
  };
  await run("logins", "readwrite", (s) => {
    s.put(record);
  });
  return record;
}

export async function getLoginLog(limit = 40, usernameLower?: string): Promise<LoginLogEntry[]> {
  const all = await run("logins", "readonly", (s) =>
    wrap<LoginLogEntry[]>(
      (usernameLower ? s.index("usernameLower").getAll(usernameLower) : s.getAll()) as IDBRequest<LoginLogEntry[]>,
    ),
  );
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

export async function clearLoginLog(usernameLower?: string): Promise<void> {
  const entries = await getLoginLog(Number.MAX_SAFE_INTEGER, usernameLower);
  await run("logins", "readwrite", (s) => {
    entries.forEach((entry) => s.delete(entry.id));
  });
}

/* ---------------------------- snapshot ----------------------------- */

export async function getDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const [users, roms, saves, logins] = await Promise.all([
    run("users", "readonly", (s) => wrap<number>(s.count())),
    run("roms", "readonly", (s) => wrap<number>(s.count())),
    run("saves", "readonly", (s) => wrap<number>(s.count())),
    run("logins", "readonly", (s) => wrap<number>(s.count())),
  ]);
  let usageBytes = 0;
  let quotaBytes = 0;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    usageBytes = estimate.usage ?? 0;
    quotaBytes = estimate.quota ?? 0;
  }
  return {
    name: DB_NAME,
    version: DB_VERSION,
    stores: [...OBJECT_STORES],
    counts: { users, roms, saves, logins },
    usageBytes,
    quotaBytes,
  };
}

/** Compact "iPadOS · Safari" / "macOS · Chrome" style label recorded with every login entry. */
export function describeDevice(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIPadOS = /Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
  const browser =
    /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = isIPadOS ? "iPadOS" : /(iPad)/.test(ua) ? "iPadOS" : /iPhone|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux" : "Device";
  return `${os} · ${browser}`;
}
