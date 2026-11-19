import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, LogOut, UserRound, X, Clock } from "lucide-react";
import { LocalEmuLogo } from "@/components/LocalEmuLogo";
import { Button, Chip, Eyebrow, Led } from "@/components/ui";
import { passwordStrength, fingerprint } from "@/lib/auth";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/rom";
import type { LoginLogEntry, UserRecord } from "@/lib/db";
import type { PublicUser } from "@/lib/auth";
import { cn } from "@/utils/cn";

export function AccountModal({
  open,
  tab,
  onTab,
  user,
  accounts,
  romCount,
  bytesUsed,
  logins,
  error,
  submitting,
  usernameSeed,
  onSubmit,
  onClose,
  onSignOut,
  onPickAccount,
}: {
  open: boolean;
  tab: "login" | "register";
  onTab: (tab: "login" | "register") => void;
  user: PublicUser | null;
  accounts: UserRecord[];
  romCount: number;
  bytesUsed: number;
  logins: LoginLogEntry[];
  error: string | null;
  submitting: boolean;
  /** prefilled username when a stored profile chip was picked */
  usernameSeed: string | null;
  onSubmit: (username: string, password: string) => void;
  onClose: () => void;
  onSignOut: () => void;
  onPickAccount: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => firstField.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setPassword("");
      return;
    }
    if (usernameSeed) {
      setUsername(usernameSeed);
      onTab("login");
    }
  }, [open, usernameSeed, onTab]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const myHistory = useMemo(
    () => logins.filter((entry) => !user || entry.usernameLower === user.usernameLower).slice(0, 4),
    [logins, user],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Local vault account"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="animate-boot-line w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-cabinet-900/95 shadow-[0_50px_120px_-40px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <LocalEmuLogo size={38} />
            <div>
              <h2 className="font-display text-[15px] leading-tight font-bold text-vellum">
                Local Account Vault
              </h2>
              <p className="font-mono text-[10px] text-ash-500">
                IndexedDB · users &amp; saves stores · SHA-256 salted
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-xl p-2 text-ash-400 transition hover:bg-cabinet-800 hover:text-vellum"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {user ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-cabinet-950/80 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ember-500 to-berry-500 font-display text-xl font-bold text-cabinet-950">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-vellum">@{user.username}</p>
                  <p className="font-mono text-[10.5px] text-ash-500">
                    {romCount} {romCount === 1 ? "game" : "games"} · {formatBytes(bytesUsed)} ·{" "}
                    {fingerprint(accounts.find((a) => a.usernameLower === user.usernameLower)?.passwordHash ?? "")}
                  </p>
                </div>
              </div>
              <Chip tone="crt">
                <Led tone="crt" className="h-1.5 w-1.5" /> active
              </Chip>
            </div>

            <div className="rounded-2xl border border-white/7 bg-cabinet-950/60 p-4">
              <Eyebrow className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-crt-400" /> recent access (from logins store)
              </Eyebrow>
              <ul className="mt-2.5 space-y-1.5">
                {myHistory.length === 0 ? (
                  <li className="font-mono text-[11px] text-ash-500">no entries yet</li>
                ) : (
                  myHistory.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                      <span className={entry.status === "success" ? "text-crt-300" : "text-berry-400"}>
                        {entry.action}
                      </span>
                      <span className="truncate text-ash-500">{entry.device}</span>
                      <span className="shrink-0 text-ash-400">{formatRelative(entry.at)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <p className="text-[11.5px] leading-relaxed text-ash-400">
              ROMs you drop while signed in are automatically filed in this account&apos;s vault on this
              browser. Signing out locks the library — it never deletes anything.
            </p>

            <div className="flex gap-2.5">
              <Button variant="danger" onClick={onSignOut} icon={<LogOut className="h-3.5 w-3.5" />} className="flex-1">
                Log out / switch
              </Button>
              <Button variant="quiet" onClick={onClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/7 bg-cabinet-950 p-1">
              {(["login", "register"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTab(value)}
                  className={cn(
                    "cursor-pointer rounded-lg py-2.5 text-[11.5px] font-bold tracking-tight transition",
                    tab === value
                      ? "bg-ember-500 text-cabinet-950 shadow-[0_8px_20px_-10px_rgba(245,158,49,0.9)]"
                      : "text-ash-400 hover:text-vellum",
                  )}
                >
                  {value === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (submitting) return;
                onSubmit(username, password);
              }}
            >
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ash-300">
                  <UserRound className="h-3 w-3 text-ember-400" /> Username
                </span>
                <input
                  ref={firstField}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  minLength={2}
                  maxLength={32}
                  autoComplete="username"
                  placeholder="e.g. RetroGamer"
                  className="w-full rounded-xl border border-white/10 bg-cabinet-950 px-3.5 py-3 text-sm text-vellum placeholder:text-ash-500 transition focus:border-ember-400/60 focus:ring-2 focus:ring-ember-400/25 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ash-300">
                  <KeyRound className="h-3 w-3 text-ember-400" /> Password
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={3}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  type="password"
                  placeholder="Local-only password"
                  className="w-full rounded-xl border border-white/10 bg-cabinet-950 px-3.5 py-3 text-sm text-vellum placeholder:text-ash-500 transition focus:border-ember-400/60 focus:ring-2 focus:ring-ember-400/25 focus:outline-none"
                />
              </label>

              {tab === "register" ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full">
                    {[0, 1, 2, 3].map((index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-full flex-1 rounded-full transition-colors duration-300",
                          index < strength.score ? strength.tone : "bg-cabinet-750",
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] tracking-wide text-ash-400 uppercase">
                    {strength.label}
                  </span>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-berry-400/35 bg-berry-500/12 px-3.5 py-2.5 text-[11.5px] text-rose-100">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="mt-1 w-full py-3 text-[13px]"
                disabled={submitting}
              >
                {submitting
                  ? "Writing to vault…"
                  : tab === "login"
                    ? "Sign in to vault"
                    : "Create local account"}
              </Button>
            </form>

            {accounts.length > 0 ? (
              <div className="mt-5 border-t border-white/7 pt-4">
                <Eyebrow>profiles stored on this browser</Eyebrow>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {accounts.map((account) => (
                    <button
                      key={account.usernameLower}
                      type="button"
                      onClick={() => onPickAccount(account.username)}
                      title={`Last access ${formatDateTime(account.lastLoginAt)}`}
                      className="cursor-pointer rounded-xl border border-white/8 bg-cabinet-850 px-2.5 py-1.5 font-mono text-[11px] text-ash-300 transition hover:-translate-y-0.5 hover:border-ember-400/45 hover:text-ember-300"
                    >
                      @{account.username}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
