/**
 * auth.ts — local credential service.
 *
 * Accounts are stored in the IndexedDB `users` store (see lib/db.ts) and every
 * authentication event is mirrored into the `logins` store so the app can show
 * a real access history. Hashing: SHA-256 over `salt:password` with a fresh
 * 128-bit random salt per account (WebCrypto, with an FNV fallback for browsers
 * served over plain http where crypto.subtle is unavailable).
 */

import {
  appendLoginLog,
  getAllUsers,
  getUser,
  putUser,
  type UserRecord,
} from "@/lib/db";

const SESSION_KEY = "localemu_active_user";

export type PublicUser = { username: string; usernameLower: string };

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const enc = new TextEncoder();

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return toHex(bytes);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const payload = enc.encode(`${salt}:${password}:${salt.length}`);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
    return toHex(digest);
  }
  // Deterministic fallback (insecure contexts only).
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const source = `${salt}:${password}`;
  for (let i = 0; i < source.length; i += 1) {
    h1 = Math.imul(h1 ^ source.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + source.charCodeAt(i) * (i + 7), 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(4);
}

export function passwordStrength(password: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (password.length >= 3) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;
  const labels = ["Too short", "Weak", "Fair", "Strong", "Vault-grade"];
  const tones = [
    "bg-cabinet-700",
    "bg-berry-500",
    "bg-ember-500",
    "bg-crt-500",
    "bg-crt-400",
  ];
  return { score, label: labels[score], tone: tones[score] };
}

export function fingerprint(hash: string): string {
  if (!hash) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export async function createAccount(
  username: string,
  password: string,
): Promise<{ user: UserRecord; created: true }> {
  const clean = username.trim().replace(/\s+/g, " ");
  const key = clean.toLowerCase();
  if (clean.length < 2) throw new AuthError("Username must be at least 2 characters.");
  if (clean.length > 32) throw new AuthError("Username must be 32 characters or fewer.");
  if (password.length < 3) throw new AuthError("Password must be at least 3 characters.");

  if (await getUser(key)) {
    throw new AuthError(`Account “${clean}” already exists on this browser — sign in instead.`);
  }

  const salt = generateSalt();
  const now = Date.now();
  const record: UserRecord = {
    usernameLower: key,
    username: clean,
    salt,
    passwordHash: await hashPassword(password, salt),
    hashAlgo: "SHA-256",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    loginCount: 1,
  };
  await putUser(record);
  await appendLoginLog({
    username: clean,
    usernameLower: key,
    action: "account-created",
    status: "success",
    detail: "SHA-256 · salted",
  });
  return { user: record, created: true };
}

export async function signIn(username: string, password: string): Promise<UserRecord> {
  const clean = username.trim();
  const key = clean.toLowerCase();
  const record = await getUser(key);

  if (!record) {
    await appendLoginLog({
      username: clean || "(blank)",
      usernameLower: key,
      action: "attempt",
      status: "failed",
      detail: "no such local account",
    });
    throw new AuthError(`No local account found for “${clean || "∅"}”.`);
  }

  const attempt = await hashPassword(password, record.salt);
  if (attempt !== record.passwordHash) {
    await appendLoginLog({
      username: record.username,
      usernameLower: key,
      action: "attempt",
      status: "failed",
      detail: "password mismatch",
    });
    throw new AuthError("Incorrect password for this local account.");
  }

  const updated: UserRecord = {
    ...record,
    lastLoginAt: Date.now(),
    loginCount: (record.loginCount ?? 0) + 1,
    updatedAt: Date.now(),
  };
  await putUser(updated);
  await appendLoginLog({
    username: record.username,
    usernameLower: key,
    action: "signed-in",
    status: "success",
    detail: "session token stored in localStorage",
  });
  return updated;
}

export async function signOut(user: PublicUser | null): Promise<void> {
  if (!user) return;
  await appendLoginLog({
    username: user.username,
    usernameLower: user.usernameLower,
    action: "signed-out",
    status: "success",
    detail: "vault locked on this tab",
  });
}

export async function listAccounts(): Promise<UserRecord[]> {
  const users = await getAllUsers();
  return users.sort((a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0));
}

/* --------------------------- session state -------------------------- */

export function readStoredSession(): PublicUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicUser>;
    if (parsed && typeof parsed.usernameLower === "string" && typeof parsed.username === "string") {
      return { username: parsed.username, usernameLower: parsed.usernameLower };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredSession(user: PublicUser | null): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage disabled — session stays in memory only */
  }
}
