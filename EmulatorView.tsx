import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookmarkCheck,
  BookmarkPlus,
  FolderOpen,
  Gamepad2,
  Keyboard,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
} from "lucide-react";
import { AccountSaveControl } from "@/components/AccountSaveControl";
import {
  PadButton,
  RedSidewaysRightCluster,
  RedSpeakerGrille,
  TouchDPad,
} from "@/components/HandheldControls";
import { Button, Chip, Eyebrow, Led, Panel } from "@/components/ui";
import { RETROPAD } from "@/lib/emulator";
import { CORE_INFO } from "@/lib/rom";
import type { PublicUser } from "@/lib/auth";
import type { AccountSaveRecord, SaveSlotId } from "@/lib/db";
import type { ActiveSession, EmulatorPhase, PadMode } from "@/types";
import { cn } from "@/utils/cn";

const KEYBINDS: { label: string; keys: string; highlight?: boolean }[] = [
  { label: "A Button (OK / Confirm)", keys: "J", highlight: true },
  { label: "B Button (Back / Cancel)", keys: "K", highlight: true },
  { label: "D-Pad", keys: "Arrow Keys" },
  { label: "X / Y Face Buttons", keys: "S  /  A" },
  { label: "Start / Select", keys: "Enter  /  Shift" },
  { label: "L / R Bumpers", keys: "Q  /  W" },
];

type DeviceKind = "desktop" | "tablet" | "mobile";

/**
 * Hardware detection.
 *
 * A laptop/desktop (even one with a touchscreen) reports a fine primary pointer
 * and hover support, so it gets the bare screen with NO on-screen controls.
 * Phones, iPads and Android tablets report a coarse first pointer with no hover
 * — those get the tap-to-play red & black handheld pads.
 */
function detectDevice(): { kind: DeviceKind; label: string; touch: boolean } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { kind: "desktop", label: "Desktop / laptop", touch: false };
  }
  const ua = navigator.userAgent;
  const maxTouch = navigator.maxTouchPoints ?? 0;
  const isIPadOS = /Macintosh/.test(ua) && maxTouch > 1;
  const mobileUA = /iPhone|iPod|Windows Phone|IEMobile|Opera Mini|Android.*Mobile/i.test(ua);
  const tabletUA = isIPadOS || /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hoverNone = window.matchMedia?.("(hover: none)").matches ?? false;
  const minSide = Math.min(window.innerWidth, window.innerHeight);

  if (mobileUA) return { kind: "mobile", label: "Phone", touch: true };
  if (tabletUA) return { kind: "tablet", label: isIPadOS ? "iPad" : "Tablet", touch: true };

  // Coarse + no-hover primary input is a touch-first device (not a touch laptop).
  if (coarse && hoverNone) {
    const tabletSized = minSide >= 600 || maxTouch > 2 || window.innerWidth >= 820;
    return tabletSized
      ? { kind: "tablet", label: "Tablet", touch: true }
      : { kind: "mobile", label: "Phone", touch: true };
  }

  return { kind: "desktop", label: "Desktop / laptop", touch: false };
}

function useDevice() {
  const [device, setDevice] = useState(detectDevice);
  useEffect(() => {
    const update = () => setDevice(detectDevice());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.matchMedia?.("(pointer: coarse)").addEventListener?.("change", update);
    window.matchMedia?.("(hover: none)").addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.matchMedia?.("(pointer: coarse)").removeEventListener?.("change", update);
      window.matchMedia?.("(hover: none)").removeEventListener?.("change", update);
    };
  }, []);
  return device;
}

export function EmulatorView({
  session,
  phase,
  bootLog,
  screenRef,
  aspectRatio,
  aspectLabel,
  user,
  savesForGame,
  onSaveAccountSlot,
  onLoadAccountSave,
  onDeleteAccountSave,
  onRequestSignIn,
  onCycleAspect,
  onReset,
  onSaveToVault,
  onBackToLibrary,
  onLoadAnother,
  controlsOpen,
  onToggleControls,
  errorMessage,
}: {
  session: ActiveSession;
  phase: EmulatorPhase;
  bootLog: string[];
  screenRef: React.RefObject<HTMLDivElement | null>;
  aspectRatio: string;
  aspectLabel: string;
  user: PublicUser | null;
  savesForGame: AccountSaveRecord[];
  onSaveAccountSlot: (slot: SaveSlotId, label: string) => Promise<void>;
  onLoadAccountSave: (record: AccountSaveRecord) => Promise<void>;
  onDeleteAccountSave: (record: AccountSaveRecord) => Promise<void>;
  onRequestSignIn: () => void;
  onCycleAspect: () => void;
  onReset: () => void;
  onSaveToVault: () => void;
  onBackToLibrary: () => void;
  onLoadAnother: () => void;
  controlsOpen: boolean;
  onToggleControls: () => void;
  errorMessage: string | null;
}) {
  const device = useDevice();
  const [padMode, setPadMode] = useState<PadMode>("auto");
  const [immersive, setImmersive] = useState(false);

  const coreMeta = CORE_INFO[session.core];
  const consoleFormFactor = coreMeta?.formFactor ?? "sideways";
  const hasFourButtons = (coreMeta?.faceButtons ?? 2) === 4;
  const needsShoulders = ["gba", "nds", "snes", "psx", "n64"].includes(session.core);

  const isTouchDevice = device.touch;

  /**
   * Desktop/laptop → always the bare screen, never a shell and never buttons.
   * Touch device → match the console: crimson sideways pad or vertical pad.
   */
  const effectiveShell: "cabinet" | "sideways" | "vertical" = useMemo(() => {
    if (!isTouchDevice) return "cabinet";
    if (padMode === "sideways") return "sideways";
    if (padMode === "vertical") return "vertical";
    if (padMode === "cabinet") return "cabinet";
    return consoleFormFactor;
  }, [consoleFormFactor, isTouchDevice, padMode]);

  useEffect(() => {
    if (!immersive) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onEsc);
    };
  }, [immersive]);

  const isSideways = effectiveShell === "sideways";
  const isVertical = effectiveShell === "vertical";
  const isHandheld = isSideways || isVertical;
  const isCompactWidth = device.kind === "mobile";

  // Grid areas keep children [0..4] mounted in identical DOM positions across all modes.
  const shellGridStyle: React.CSSProperties = isSideways
    ? {
        display: "grid",
        gridTemplateAreas: `
          "shoulders shoulders shoulders"
          "left      screen    right"
        `,
        gridTemplateColumns: isCompactWidth
          ? "78px minmax(0, 1fr) 82px"
          : "clamp(108px, 14vw, 142px) minmax(0, 1fr) clamp(112px, 14.5vw, 146px)",
        gridTemplateRows: "auto minmax(0, 1fr)",
        alignItems: "center",
      }
    : isVertical
      ? {
          display: "grid",
          gridTemplateAreas: `
            "shoulders shoulders"
            "screen    screen"
            "left      right"
            "bottom    bottom"
          `,
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto auto auto",
        }
      : { display: "block" };

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5",
        immersive &&
          "fixed inset-0 z-[60] flex flex-col justify-center overflow-y-auto bg-cabinet-950/98 p-2 sm:p-4",
      )}
    >
      {/* Top bar */}
      <div className="relative rounded-2xl border border-white/8 bg-gradient-to-r from-cabinet-850 via-cabinet-800 to-cabinet-900 px-3.5 py-3 sm:rounded-t-[26px] sm:rounded-b-none sm:border-b-0 sm:px-6 sm:py-3.5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="h-full w-full cartridge-strip opacity-[0.09]" />
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="h-2.5 w-2.5 rounded-full bg-berry-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-ember-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-crt-400/80" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-sm leading-tight font-bold text-vellum sm:text-base">
                  {session.title}
                </p>
                <Chip
                  tone={phase === "ready" ? "crt" : phase === "error" ? "berry" : "ember"}
                  className="shrink-0"
                >
                  {phase === "ready" ? (
                    <>
                      <Led tone="crt" className="h-1.5 w-1.5" /> live
                    </>
                  ) : phase === "error" ? (
                    "error"
                  ) : (
                    "booting"
                  )}
                </Chip>
              </div>
              <p className="truncate font-mono text-[10px] text-ash-400">
                {session.coreName} ({session.engine}) ·{" "}
                <span className="text-ember-300">J = OK · K = Back</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AccountSaveControl
              user={user}
              savesForGame={savesForGame}
              coreReady={phase === "ready"}
              compact={immersive || isCompactWidth}
              onSaveSlot={onSaveAccountSlot}
              onLoadSave={onLoadAccountSave}
              onDeleteSave={onDeleteAccountSave}
              onRequestSignIn={onRequestSignIn}
            />

            {/* Detected input hardware */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2 py-1.5 font-mono text-[10px] font-semibold",
                isTouchDevice
                  ? "border-berry-400/35 bg-berry-500/10 text-[#ff9aa6]"
                  : "border-white/10 bg-cabinet-950/80 text-ash-300",
              )}
              title={
                isTouchDevice
                  ? "Touch screen detected — on-screen controls enabled"
                  : "Laptop / desktop detected — clean screen, keyboard or gamepad only"
              }
            >
              {isTouchDevice ? (
                <>
                  {device.kind === "tablet" ? (
                    <Tablet className="h-3.5 w-3.5" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">Touch pad</span>
                </>
              ) : (
                <>
                  <Monitor className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clean screen</span>
                </>
              )}
            </span>

            {/* Pad switcher only exists on touch hardware */}
            {isTouchDevice ? (
              <div
                role="group"
                aria-label="On-screen console layout"
                className="inline-flex items-center rounded-xl border border-white/10 bg-cabinet-950/90 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setPadMode("auto")}
                  title={`Auto — match this console (${consoleFormFactor === "vertical" ? "Vertical" : "Sideways"} pad)`}
                  className={cn(
                    "cursor-pointer rounded-lg px-2 py-1 font-mono text-[10px] font-semibold transition",
                    padMode === "auto"
                      ? "bg-[#d4203a] text-white"
                      : "text-ash-400 hover:text-vellum",
                  )}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setPadMode("sideways")}
                  title="Crimson Sideways Pad"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-mono text-[10px] font-semibold transition",
                    padMode === "sideways"
                      ? "bg-[#b3122a] text-white"
                      : "text-ash-400 hover:text-vellum",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-[#ff3d55]" />
                  <span className="hidden xs:inline sm:inline">Sideways</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPadMode("vertical")}
                  title="Crimson Vertical Pad"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-mono text-[10px] font-semibold transition",
                    padMode === "vertical"
                      ? "bg-[#b3122a] text-white"
                      : "text-ash-400 hover:text-vellum",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-[#ff3d55]" />
                  <span className="hidden xs:inline sm:inline">Vertical</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setImmersive((v) => !v)}
              title={immersive ? "Exit full-screen view" : "Expand full-screen"}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-cabinet-850 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-ash-200 transition hover:border-ember-400/45 hover:text-vellum"
            >
              {immersive ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-ember-400" />
                  <span className="hidden sm:inline">Exit</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-ember-400" />
                  <span className="hidden sm:inline">Expand</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Console body */}
      <Panel
        className={cn(
          "p-2.5 sm:rounded-t-none sm:p-5",
          immersive && "flex flex-1 flex-col justify-center border-white/10 bg-cabinet-950/60",
          isTouchDevice ? "bg-cabinet-950/40" : "bg-transparent p-0 sm:p-0 shadow-none border-0",
        )}
      >
        {/*
         * Persistent shell container: children [0..4] never change order, so
         * `screenRef` stays mounted when rotating a phone/tablet or switching pads.
         * On desktop, children 0/1/3/4 stay hidden and only the screen renders.
         */}
        <div
          style={shellGridStyle}
          className={cn(
            "mx-auto w-full transition-colors duration-300",
            isHandheld && "handheld-pad-active relative z-10",
            isSideways &&
              "shell-red-sideways max-w-[1160px] rounded-[26px] px-2 pt-2 pb-3 sm:rounded-[34px] sm:px-3.5 sm:pt-2.5 sm:pb-4",
            isVertical &&
              "shell-red-vertical max-w-[452px] rounded-t-[26px] rounded-br-[54px] rounded-bl-[26px] px-3 pt-2.5 pb-4 sm:max-w-[492px] sm:px-4 sm:pt-3.5 sm:pb-5",
            !isHandheld && "max-w-[1060px]",
          )}
        >
          {/* [0] Shoulder bumpers — touch only */}
          <div
            style={{ gridArea: "shoulders", position: "relative", zIndex: 20 }}
            className={cn(
              !isHandheld && "hidden",
              isSideways && "mb-1.5 flex items-center justify-between px-1 sm:mb-2 sm:px-2",
              isVertical &&
                (needsShoulders || hasFourButtons
                  ? "mb-1.5 flex items-center justify-between px-1"
                  : "hidden"),
            )}
          >
            <PadButton
              slot={RETROPAD.L}
              label="L"
              ariaLabel="Left shoulder bumper"
              pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
              className="h-6 min-w-[54px] rounded-t-xl rounded-b-md border border-[#ff8492]/45 bg-gradient-to-b from-[#c9182f] via-[#8f0d20] to-[#4a050e] px-3 font-mono text-[10px] font-bold tracking-wider text-[#ffe3e7] shadow-[0_2px_6px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,200,205,0.4)] sm:h-7 sm:min-w-[70px]"
            />
            <span className="pad-touch font-mono text-[9px] font-bold tracking-[0.26em] text-[#ffb3bb]/60 uppercase">
              {isSideways ? "LocalEmu · Crimson" : "LocalEmu · Pocket"}
            </span>
            <PadButton
              slot={RETROPAD.R}
              label="R"
              ariaLabel="Right shoulder bumper"
              pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
              className="h-6 min-w-[54px] rounded-t-xl rounded-b-md border border-[#ff8492]/45 bg-gradient-to-b from-[#c9182f] via-[#8f0d20] to-[#4a050e] px-3 font-mono text-[10px] font-bold tracking-wider text-[#ffe3e7] shadow-[0_2px_6px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,200,205,0.4)] sm:h-7 sm:min-w-[70px]"
            />
          </div>

          {/* [1] Left control zone — touch only */}
          <div
            style={{ gridArea: "left", position: "relative", zIndex: 20 }}
            className={cn(
              !isHandheld && "hidden",
              isSideways && "flex h-full flex-col items-center justify-between py-1 pr-1 sm:pr-2",
              isVertical && "flex items-center justify-start pt-4 pb-2 pl-2 sm:pt-5 sm:pl-3",
            )}
          >
            {isSideways ? <div className="h-2" /> : null}
            <TouchDPad size={isSideways && isCompactWidth ? "sm" : isVertical ? "lg" : "md"} />
            {isSideways ? (
              <div className="pad-touch flex items-center gap-1.5 self-start pl-1 pt-2 sm:pl-2">
                <span className="font-mono text-[7.5px] font-bold tracking-wider text-[#ffb3bb]/80 uppercase sm:text-[8.5px]">
                  Power
                </span>
                <span className="h-3 w-3 rounded-full border border-[#ff8a97]/50 bg-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.85)]" />
                <span className="h-2 w-2 rounded-full bg-[#ff3b55] shadow-[0_0_9px_#ff3b55]" />
              </div>
            ) : null}
          </div>

          {/* [2] Screen — plain on desktop, inset in the red bezel on touch */}
          <div
            style={{ gridArea: "screen" }}
            className={cn(
              "w-full",
              isSideways &&
                "rounded-[14px] border-2 border-black bg-[#050608] p-1 shadow-[inset_0_3px_10px_rgba(0,0,0,0.95),0_1px_0_rgba(255,150,160,0.3)] sm:rounded-[18px] sm:p-2",
              isVertical &&
                "rounded-[18px] border-2 border-black bg-[#0b0d10] p-2 shadow-[inset_0_3px_12px_rgba(0,0,0,0.9),0_2px_0_rgba(255,170,178,0.4)] sm:p-2.5",
            )}
          >
            <div
              className={cn(
                "relative mx-auto flex w-full items-center justify-center overflow-hidden bg-black transition-[aspect-ratio] duration-300",
                isHandheld
                  ? "rounded-[10px] border border-black"
                  : "screen-only-frame rounded-[18px] sm:rounded-2xl",
              )}
              style={{ aspectRatio }}
            >
              <div ref={screenRef} className="absolute inset-0 [&_canvas]:h-full [&_canvas]:w-full" />
              <div className="pointer-events-none absolute inset-0 scanlines opacity-20" />

              {phase !== "ready" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cabinet-950/92 px-4 text-center">
                  {phase === "error" ? (
                    <>
                      <AlertTriangle className="h-6 w-6 text-berry-400" />
                      <p className="max-w-[44ch] text-xs leading-relaxed text-ash-200 sm:text-[13px]">
                        {errorMessage ?? "The core could not start."}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
                          Retry boot
                        </Button>
                        <Button variant="quiet" size="sm" onClick={onBackToLibrary}>
                          Back to library
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-ember-400" />
                      <p className="font-display text-sm font-bold tracking-tight text-vellum sm:text-lg">
                        Initialising {session.engine}
                      </p>
                      <div className="hidden w-full max-w-sm space-y-1 rounded-xl border border-white/8 bg-cabinet-950/80 p-3 text-left sm:block">
                        {bootLog.map((line, index) => (
                          <p
                            key={`${line}-${index}`}
                            className="animate-boot-line font-mono text-[10.5px] text-crt-300/90"
                            style={{ animationDelay: `${index * 90}ms` }}
                          >
                            <span className="text-ash-500">$ </span>
                            {line}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* [3] Right control zone — touch only */}
          <div
            style={{ gridArea: "right", position: "relative", zIndex: 20 }}
            className={cn(
              !isHandheld && "hidden",
              isSideways && "flex h-full items-center justify-center pl-1 sm:pl-2",
              isVertical && "flex flex-col items-end justify-center pt-4 pr-2 pb-2 sm:pt-5 sm:pr-4",
            )}
          >
            {isSideways ? (
              <RedSidewaysRightCluster compact={isCompactWidth} />
            ) : isVertical ? (
              <div className="flex flex-col items-center gap-2">
                {hasFourButtons ? (
                  <div className="flex items-center gap-3 pr-2">
                    <PadButton
                      slot={RETROPAD.Y}
                      label="Y"
                      ariaLabel="Y button"
                      pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
                      className="h-8 w-8 rounded-full border border-[#ff8492]/50 bg-gradient-to-b from-[#e02440] to-[#7d0a1b] font-display text-[10px] font-bold text-[#ffe9ec] shadow-[0_3px_6px_rgba(0,0,0,0.65)]"
                    />
                    <PadButton
                      slot={RETROPAD.X}
                      label="X"
                      ariaLabel="X button"
                      pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
                      className="h-8 w-8 -translate-y-2 rounded-full border border-[#ff8492]/50 bg-gradient-to-b from-[#e02440] to-[#7d0a1b] font-display text-[10px] font-bold text-[#ffe9ec] shadow-[0_3px_6px_rgba(0,0,0,0.65)]"
                    />
                  </div>
                ) : null}

                {/* Angled B (Back) & A (OK) cluster */}
                <div className="relative -rotate-[24deg] flex items-center gap-4 rounded-full bg-black/25 px-3.5 py-2.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] sm:gap-5 sm:px-4 sm:py-3">
                  <PadButton
                    slot={RETROPAD.B}
                    ariaLabel="B button (Back)"
                    label="B"
                    pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
                    className="h-12 w-12 rounded-full border border-[#ff8492]/55 bg-gradient-to-b from-[#e62844] via-[#a81026] to-[#5c0612] font-display text-sm font-bold text-[#ffe9ec] shadow-[0_5px_10px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,205,210,0.5)] sm:h-14 sm:w-14"
                  />
                  <PadButton
                    slot={RETROPAD.A}
                    ariaLabel="A button (OK)"
                    label="A"
                    pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
                    className="h-12 w-12 rounded-full border border-[#ff8492]/55 bg-gradient-to-b from-[#e62844] via-[#a81026] to-[#5c0612] font-display text-sm font-bold text-[#ffe9ec] shadow-[0_5px_10px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,205,210,0.5)] sm:h-14 sm:w-14"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* [4] Vertical bottom row — touch only */}
          <div
            style={{ gridArea: "bottom" }}
            className={cn(
              !isVertical && "hidden",
              isVertical && "mt-3 flex items-end justify-between pl-6 pr-2 pt-2 sm:mt-4 sm:pl-10",
            )}
          >
            <div className="mx-auto flex items-center gap-5 pl-6 sm:gap-6">
              <div className="flex flex-col items-center gap-1">
                <PadButton
                  slot={RETROPAD.SELECT}
                  ariaLabel="Select"
                  pressedClassName="bg-[#ff2d4e]"
                  className="h-3.5 w-12 rounded-full border border-[#ff8492]/45 bg-gradient-to-b from-[#3a0a12] to-[#12050a] shadow-[0_3px_6px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,180,186,0.35)]"
                />
                <span className="pad-touch font-mono text-[8.5px] font-bold tracking-widest text-[#ffb3bb]/85 uppercase">
                  Select
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PadButton
                  slot={RETROPAD.START}
                  ariaLabel="Start"
                  pressedClassName="bg-[#ff2d4e]"
                  className="h-3.5 w-12 rounded-full border border-[#ff8492]/45 bg-gradient-to-b from-[#3a0a12] to-[#12050a] shadow-[0_3px_6px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,180,186,0.35)]"
                />
                <span className="pad-touch font-mono text-[8.5px] font-bold tracking-widest text-[#ffb3bb]/85 uppercase">
                  Start
                </span>
              </div>
            </div>

            <div className="pr-1 pb-0.5">
              <RedSpeakerGrille />
            </div>
          </div>
        </div>

        {/* Bottom action rail */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={session.isSavedInVault ? "success" : "quiet"}
              size="sm"
              onClick={onSaveToVault}
              icon={
                session.isSavedInVault ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5 text-ember-400" />
                )
              }
            >
              {session.isSavedInVault ? "ROM in Vault" : "Pin ROM to Vault"}
            </Button>
            <Button variant="quiet" size="sm" onClick={onBackToLibrary} icon={<LayoutGrid className="h-3.5 w-3.5 text-ember-400" />}>
              Game library
            </Button>
            <Button variant="quiet" size="sm" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5 text-ember-400" />}>
              Restart
            </Button>
            <Button variant="quiet" size="sm" onClick={onCycleAspect}>
              Aspect · {aspectLabel}
            </Button>
            <Button variant="quiet" size="sm" onClick={onToggleControls} icon={<Keyboard className="h-3.5 w-3.5 text-crt-400" />}>
              Controls
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={onLoadAnother} icon={<FolderOpen className="h-3.5 w-3.5" />}>
            Load another ROM
          </Button>
        </div>

        {/* Controls & device guide */}
        <div
          className={cn(
            "grid overflow-hidden transition-all duration-500",
            controlsOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0">
            <div className="grid gap-3 rounded-2xl border border-white/7 bg-cabinet-950/70 p-4 sm:p-5 md:grid-cols-[1.12fr_1fr]">
              <div>
                <Eyebrow className="flex items-center gap-1.5">
                  <Keyboard className="h-3 w-3 text-ember-400" /> keyboard binding map (J = OK · K = Back)
                </Eyebrow>
                <ul className="mt-3 space-y-1.5">
                  {KEYBINDS.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5 font-mono text-[11px] last:border-0"
                    >
                      <span className={item.highlight ? "font-semibold text-ember-300" : "text-ash-400"}>
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-right",
                          item.highlight
                            ? "border border-ember-400/40 bg-ember-500/15 font-bold text-ember-200"
                            : "text-ash-200",
                        )}
                      >
                        {item.keys}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex-1 rounded-xl border border-white/7 bg-cabinet-900/70 p-3.5">
                  <p className="flex items-center gap-2 text-[11px] font-bold text-[#ff9aa6]">
                    {isTouchDevice ? <Tablet className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                    {isTouchDevice ? `${device.label} detected · on-screen pad` : `${device.label} detected · clean screen`}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ash-400">
                    {isTouchDevice
                      ? "Tap-to-play crimson controls are enabled: sideways consoles get the wide red pad, vertical consoles the tall red pad — both with a large screen."
                      : "No on-screen buttons around the screen. Use the keyboard (J = OK, K = Back) or pair a Bluetooth / USB controller."}
                  </p>
                </div>
                <div className="flex-1 rounded-xl border border-white/7 bg-cabinet-900/70 p-3.5">
                  <p className="flex items-center gap-2 text-[11px] font-bold text-crt-300">
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <Save className="h-3.5 w-3.5" /> Per-account saves
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ash-400">
                    Hit <strong className="text-[#ffc2c9]">Save to @account</strong> to snapshot the exact game state into your private IndexedDB slot — resume it any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
