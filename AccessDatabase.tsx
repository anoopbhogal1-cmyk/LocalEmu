import { Database, Eraser, Fingerprint, ShieldCheck, Trash2, UserCog, KeySquare } from "lucide-react";
import { Button, Chip, Eyebrow, Led, Panel, Reveal } from "@/components/ui";
import { fingerprint, type PublicUser } from "@/lib/auth";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/rom";
import type { DatabaseSnapshot, LoginLogEntry, UserRecord } from "@/lib/db";
import { cn } from "@/utils/cn";

export function AccessDatabase({
  snapshot,
  accounts,
  logins,
  dbError,
  user,
  onWipeLog,
  onDeleteAccount,
  onOpenAccount,
}: {
  snapshot: DatabaseSnapshot | null;
  accounts: UserRecord[];
  logins: LoginLogEntry[];
  dbError: string | null;
  user: PublicUser | null;
  onWipeLog: () => void;
  onDeleteAccount: (account: UserRecord) => void;
  onOpenAccount: () => void;
}) {
  const usedPct =
    snapshot && snapshot.quotaBytes > 0
      ? Math.min(100, (snapshot.usageBytes / snapshot.quotaBytes) * 100)
      : 0;

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/7 px-6 py-5 sm:px-7">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-crt-400/25 bg-crt-500/10">
            <Database className="h-4.5 w-4.5 text-crt-400" />
          </div>
          <div>
            <Eyebrow>credential &amp; library storage</Eyebrow>
            <h2 className="mt-1.5 font-display text-2xl leading-none font-bold tracking-tight text-vellum">
              Vault Database
            </h2>
            <p className="mt-2 max-w-[66ch] text-[12.5px] leading-relaxed text-ash-400">
              This is where logins live: the{" "}
              <code className="rounded bg-cabinet-850 px-1.5 py-0.5 font-mono text-[11px] text-ember-300">users</code>{" "}
              object store holds one record per account (salt + SHA-256 digest, never the password), and{" "}
              <code className="rounded bg-cabinet-850 px-1.5 py-0.5 font-mono text-[11px] text-ember-300">logins</code>{" "}
              keeps the access trail. Both are browser-local IndexedDB.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="crt">
            <Led tone="crt" className="h-1.5 w-1.5" />
            {dbError ? "unavailable" : snapshot ? `${snapshot.name} v${snapshot.version}` : "opening…"}
          </Chip>
          <Button variant="quiet" size="sm" onClick={onWipeLog} icon={<Eraser className="h-3.5 w-3.5 text-ash-400" />}>
            Clear access log
          </Button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.02fr_1fr]">
        {/* users store */}
        <div className="border-b border-white/7 p-6 sm:p-7 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between">
            <Eyebrow className="flex items-center gap-1.5">
              <UserCog className="h-3 w-3 text-ember-400" /> object store · users ({snapshot?.counts.users ?? 0})
            </Eyebrow>
            {user ? <Chip tone="ember">session active</Chip> : null}
          </div>

          {accounts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-cabinet-950/60 p-6 text-center">
              <KeySquare className="mx-auto h-6 w-6 text-ash-500" />
              <p className="mt-3 font-display text-sm font-bold text-ash-200">
                No credentials stored yet
              </p>
              <p className="mx-auto mt-1.5 max-w-[42ch] text-[11.5px] leading-relaxed text-ash-500">
                Create a local account and its hashed record is written straight into the{" "}
                <span className="text-ember-300">users</span> store.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onOpenAccount}>
                Create account
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {accounts.map((account) => (
                <li
                  key={account.usernameLower}
                  className={cn(
                    "group rounded-2xl border bg-cabinet-950/60 p-3.5 transition-all duration-300 hover:-translate-y-0.5",
                    user?.usernameLower === account.usernameLower
                      ? "border-ember-400/45"
                      : "border-white/7 hover:border-crt-400/35",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-display text-[13.5px] font-bold text-vellum">
                        @{account.username}
                        {user?.usernameLower === account.usernameLower ? (
                          <span className="rounded-full bg-ember-500/15 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-ember-300 uppercase">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-ash-500">
                        <span className="inline-flex items-center gap-1 text-crt-300/80">
                          <Fingerprint className="h-3 w-3" />
                          {account.hashAlgo} {fingerprint(account.passwordHash)}
                        </span>
                        <span>salt {account.salt.slice(0, 8)}…</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Delete this account and its vault"
                      onClick={() => onDeleteAccount(account)}
                      className="cursor-pointer rounded-lg border border-white/8 bg-cabinet-850 p-1.5 text-ash-500 opacity-0 transition group-hover:opacity-100 hover:border-berry-400/50 hover:text-berry-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white/5 pt-2.5 font-mono text-[10px]">
                    <span className="text-ash-500">
                      created<span className="mt-0.5 block text-ash-200">{formatDateTime(account.createdAt)}</span>
                    </span>
                    <span className="text-ash-500">
                      last in<span className="mt-0.5 block text-ash-200">{formatRelative(account.lastLoginAt)}</span>
                    </span>
                    <span className="text-ash-500">
                      entries<span className="mt-0.5 block text-ash-200">{account.loginCount}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* logins store */}
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <Eyebrow className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-crt-400" /> object store · logins ({snapshot?.counts.logins ?? 0})
            </Eyebrow>
            <Chip>{logins.length} shown</Chip>
          </div>

          {logins.length === 0 ? (
            <Reveal className="mt-4">
              <div className="rounded-2xl border border-dashed border-white/10 bg-cabinet-950/60 p-6 text-center">
                <p className="font-display text-sm font-bold text-ash-200">Access log is empty</p>
                <p className="mt-1.5 text-[11.5px] text-ash-500">
                  Sign-ins, failures and account creations are appended here as timestamped records.
                </p>
              </div>
            </Reveal>
          ) : (
            <ul className="mt-4 max-h-[336px] space-y-1.5 overflow-y-auto pr-1">
              {logins.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-white/6 bg-cabinet-950/50 px-3 py-2.5 transition hover:border-white/12 hover:bg-cabinet-900/70"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      entry.status === "success"
                        ? "bg-crt-400 shadow-[0_0_8px_rgba(77,216,194,0.7)]"
                        : "bg-berry-400 shadow-[0_0_8px_rgba(255,107,129,0.7)]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-ash-200">
                      <span className="text-vellum">@{entry.username}</span>{" "}
                      <span className={entry.status === "success" ? "text-crt-300" : "text-berry-400"}>
                        {entry.action}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ash-500">
                      {entry.device}
                      {entry.detail ? ` · ${entry.detail}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-ash-500">{formatRelative(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* footer: storage estimate */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/7 bg-cabinet-950/60 px-6 py-4 sm:px-7">
        <span className="font-mono text-[10.5px] tracking-wide text-ash-500 uppercase">
          origin quota
        </span>
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cabinet-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-crt-400 via-ember-400 to-berry-400 transition-[width] duration-700"
              style={{ width: `${Math.max(usedPct, 1.5)}%` }}
            />
          </div>
          <span className="font-mono text-[10.5px] text-ash-300">
            {formatBytes(snapshot?.usageBytes ?? 0)} / {formatBytes(snapshot?.quotaBytes ?? 0)}
          </span>
        </div>
        <span className="font-mono text-[10.5px] text-ash-500">
          roms: {snapshot?.counts.roms ?? 0} · saves: {snapshot?.counts.saves ?? 0} · users:{" "}
          {snapshot?.counts.users ?? 0} · logins: {snapshot?.counts.logins ?? 0}
        </span>
      </div>
    </Panel>
  );
}
