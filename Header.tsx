import { ChevronDown, Download, Users } from "lucide-react";
import { LocalEmuLogo } from "@/components/LocalEmuLogo";
import { Chip, Led } from "@/components/ui";
import { CORE_INFO, type ConsoleChoice } from "@/lib/rom";
import type { PublicUser } from "@/lib/auth";

const CONSOLE_OPTIONS: { value: ConsoleChoice; label: string }[] = [
  { value: "auto", label: "Auto-detect core" },
  ...(Object.keys(CORE_INFO) as (keyof typeof CORE_INFO)[]).map((core) => ({
    value: core as ConsoleChoice,
    label: `${CORE_INFO[core].name} · ${CORE_INFO[core].engine}`,
  })),
];

export function Header({
  consoleChoice,
  onConsoleChange,
  user,
  gameCount,
  saveCount,
  onOpenAccount,
  onSaveApp,
  activeConsole,
  dbLabel,
}: {
  consoleChoice: ConsoleChoice;
  onConsoleChange: (value: ConsoleChoice) => void;
  user: PublicUser | null;
  gameCount: number;
  saveCount: number;
  onOpenAccount: () => void;
  onSaveApp: () => void;
  activeConsole: string | null;
  dbLabel: string;
}) {
  return (
    <header className="sticky top-0 z-40">
      <div className="h-[3px] w-full cartridge-strip opacity-85" />
      <div className="border-b border-white/8 bg-cabinet-950/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 sm:gap-4 sm:px-7 sm:py-3">
          {/* Brand Logo & Hub Title */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex items-center justify-center rounded-full shadow-[0_0_26px_-4px_rgba(77,243,255,0.45)] transition-transform duration-300 hover:scale-105">
              <LocalEmuLogo size={48} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg leading-none font-bold tracking-tight text-vellum sm:text-xl">
                  LOCAL<span className="text-ember-400">EMU</span>
                </span>
                <span className="hidden rounded-md border border-pink-500/35 bg-pink-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-cyan-300 uppercase md:inline-block">
                  Retro Game Emulation Hub
                </span>
                {activeConsole ? (
                  <Chip tone="ember" className="hidden sm:inline-flex">
                    {activeConsole}
                  </Chip>
                ) : null}
              </div>
              <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[10px] tracking-tight text-ash-400">
                <Led tone="crt" className="h-1.5 w-1.5" />
                {dbLabel}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
            <div className="relative">
              <select
                aria-label="Console core override"
                value={consoleChoice}
                onChange={(event) => onConsoleChange(event.target.value as ConsoleChoice)}
                className="max-w-[162px] cursor-pointer appearance-none truncate rounded-xl border border-white/8 bg-cabinet-850 py-2 pr-7 pl-2.5 font-mono text-[11px] font-semibold text-ash-200 transition hover:border-ember-400/40 hover:text-vellum focus:ring-2 focus:ring-ember-400/60 focus:outline-none sm:max-w-none sm:pr-8 sm:pl-3 sm:text-xs"
              >
                {CONSOLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-ash-500" />
            </div>

            <button
              type="button"
              onClick={onOpenAccount}
              className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-cabinet-850 px-3 py-2 text-xs font-semibold text-ash-200 transition hover:border-cyan-400/45 hover:text-vellum"
            >
              <Led tone={user ? "crt" : "ash"} className="h-2.5 w-2.5" />
              <span className="max-w-[115px] truncate">{user ? `@${user.username}` : "Sign in / vault"}</span>
              {user ? (
                <span
                  title={`${gameCount} cartridges · ${saveCount} account saves`}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/12 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200"
                >
                  <Users className="h-3 w-3" />
                  {gameCount}
                  {saveCount > 0 ? ` · ${saveCount}💾` : ""}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={onSaveApp}
              title="Download this launcher as a standalone offline .html file"
              className="hidden cursor-pointer items-center gap-1.5 rounded-xl border border-white/8 bg-cabinet-850 px-3 py-2 text-xs font-semibold text-ash-200 transition hover:border-crt-400/45 hover:text-crt-300 md:inline-flex"
            >
              <Download className="h-3.5 w-3.5 text-crt-400" />
              Save app
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
