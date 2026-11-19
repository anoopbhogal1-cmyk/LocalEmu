import { useCallback, useEffect, useRef, useState } from "react";
import { RETROPAD, pressEmulatorButton, type RetroPadSlot } from "@/lib/emulator";
import { cn } from "@/utils/cn";

function haptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}

type DPadDirs = { up: boolean; down: boolean; left: boolean; right: boolean };
const IDLE_DIRS: DPadDirs = { up: false, down: false, left: false, right: false };

/**
 * 8-way slide-capable Cross D-Pad.
 *
 * Both native touch events (required on iOS / iPadOS, which often never deliver
 * `pointerup` after a `pointerdown` on a captured element) and pointer events
 * (mouse / stylus / Android) are wired, each guarded so only one path drives
 * the core. Multi-touch is independent per button.
 */
export function TouchDPad({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const activeTouch = useRef<number | null>(null);
  const usingTouch = useRef(false);
  const dirsRef = useRef<DPadDirs>(IDLE_DIRS);
  const [dirs, setDirs] = useState<DPadDirs>(IDLE_DIRS);

  const applyDirs = useCallback((next: DPadDirs) => {
    const prev = dirsRef.current;
    if (
      prev.up === next.up &&
      prev.down === next.down &&
      prev.left === next.left &&
      prev.right === next.right
    ) {
      return;
    }
    if (prev.up !== next.up) pressEmulatorButton(RETROPAD.UP, next.up);
    if (prev.down !== next.down) pressEmulatorButton(RETROPAD.DOWN, next.down);
    if (prev.left !== next.left) pressEmulatorButton(RETROPAD.LEFT, next.left);
    if (prev.right !== next.right) pressEmulatorButton(RETROPAD.RIGHT, next.right);
    if (next.up || next.down || next.left || next.right) haptic(6);
    dirsRef.current = next;
    setDirs(next);
  }, []);

  useEffect(() => {
    return () => {
      const cur = dirsRef.current;
      if (cur.up) pressEmulatorButton(RETROPAD.UP, false);
      if (cur.down) pressEmulatorButton(RETROPAD.DOWN, false);
      if (cur.left) pressEmulatorButton(RETROPAD.LEFT, false);
      if (cur.right) pressEmulatorButton(RETROPAD.RIGHT, false);
    };
  }, []);

  const updateFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
      const dist = Math.hypot(nx, ny);
      if (dist < 0.16) {
        applyDirs(IDLE_DIRS);
        return;
      }
      const threshold = 0.28;
      applyDirs({
        left: nx < -threshold,
        right: nx > threshold,
        up: ny < -threshold,
        down: ny > threshold,
      });
    },
    [applyDirs],
  );

  const release = useCallback(() => {
    activePointer.current = null;
    activeTouch.current = null;
    applyDirs(IDLE_DIRS);
  }, [applyDirs]);

  const dims =
    size === "sm"
      ? "h-[74px] w-[74px]"
      : size === "lg"
        ? "h-[124px] w-[124px]"
        : "h-[104px] w-[104px] sm:h-[118px] sm:w-[118px]";

  return (
    <div
      ref={padRef}
      role="group"
      aria-label="Directional Pad"
      onContextMenu={(e) => e.preventDefault()}
      /* ---- native touch path (iOS / iPadOS / Android) ---- */
      onTouchStart={(e) => {
        e.preventDefault();
        usingTouch.current = true;
        const touch = e.changedTouches[0];
        if (!touch) return;
        activeTouch.current = touch.identifier;
        updateFromPoint(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        if (activeTouch.current === null) return;
        e.preventDefault();
        const touch = Array.from(e.changedTouches).find(
          (t) => t.identifier === activeTouch.current,
        );
        if (touch) updateFromPoint(touch.clientX, touch.clientY);
      }}
      onTouchEnd={(e) => {
        if (activeTouch.current === null) return;
        e.preventDefault();
        release();
        usingTouch.current = false;
      }}
      onTouchCancel={() => {
        release();
        usingTouch.current = false;
      }}
      /* ---- pointer path (mouse / stylus only — touch handled above) ---- */
      onPointerDown={(e) => {
        if (usingTouch.current || e.pointerType === "touch") return;
        e.preventDefault();
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (usingTouch.current || activePointer.current !== e.pointerId) return;
        e.preventDefault();
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (usingTouch.current || activePointer.current !== e.pointerId) return;
        release();
      }}
      onPointerCancel={(e) => {
        if (usingTouch.current || activePointer.current !== e.pointerId) return;
        release();
      }}
      onLostPointerCapture={(e) => {
        if (usingTouch.current || activePointer.current !== e.pointerId) return;
        release();
      }}
      className={cn("pad-touch relative shrink-0 cursor-pointer", dims)}
    >
      {/* Recessed circular well */}
      <div className="pointer-events-none absolute inset-1 rounded-full bg-black/35 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]" />

      {/* Vertical arm */}
      <div
        className={cn(
          "pointer-events-none absolute top-[6%] bottom-[6%] left-[33.5%] w-[33%] rounded-[6px] border border-white/10 transition-colors duration-75",
          "bg-gradient-to-b from-[#26282e] via-[#111317] to-[#050608] shadow-[0_3px_8px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)]",
          (dirs.up || dirs.down) && "from-[#ff3d55] via-[#a30f22] to-[#5c0712] brightness-110",
        )}
      />
      {/* Horizontal arm */}
      <div
        className={cn(
          "pointer-events-none absolute top-[33.5%] right-[6%] left-[6%] h-[33%] rounded-[6px] border border-white/10 transition-colors duration-75",
          "bg-gradient-to-b from-[#26282e] via-[#111317] to-[#050608] shadow-[0_3px_8px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)]",
          (dirs.left || dirs.right) && "from-[#ff3d55] via-[#a30f22] to-[#5c0712] brightness-110",
        )}
      />
      {/* Seamless center with red ring */}
      <div className="pointer-events-none absolute top-[34.5%] left-[34.5%] flex h-[31%] w-[31%] items-center justify-center bg-[#101216]">
        <div
          className={cn(
            "h-[62%] w-[62%] rounded-full border transition-colors duration-75",
            dirs.up || dirs.down || dirs.left || dirs.right
              ? "border-[#ff6b7a]/70 bg-[#52060e]"
              : "border-white/10 bg-black/70",
          )}
        />
      </div>

      {/* Direction ticks */}
      <span
        className={cn(
          "pointer-events-none absolute top-[14%] left-1/2 h-[11%] w-[3px] -translate-x-1/2 rounded-full bg-[#ff7d89]/55 transition-opacity",
          dirs.up && "bg-white opacity-100",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute bottom-[14%] left-1/2 h-[11%] w-[3px] -translate-x-1/2 rounded-full bg-[#ff7d89]/55 transition-opacity",
          dirs.down && "bg-white opacity-100",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-[14%] h-[3px] w-[11%] -translate-y-1/2 rounded-full bg-[#ff7d89]/55 transition-opacity",
          dirs.left && "bg-white opacity-100",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 right-[14%] h-[3px] w-[11%] -translate-y-1/2 rounded-full bg-[#ff7d89]/55 transition-opacity",
          dirs.right && "bg-white opacity-100",
        )}
      />
    </div>
  );
}

/** Multi-touch safe individual handheld button (touch + pointer + mouse). */
export function PadButton({
  slot,
  label,
  subLabel,
  className,
  pressedClassName,
  ariaLabel,
}: {
  slot: RetroPadSlot;
  label?: string;
  subLabel?: string;
  className?: string;
  pressedClassName?: string;
  ariaLabel?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const isDown = useRef(false);
  const usingTouch = useRef(false);

  const down = useCallback(() => {
    if (isDown.current) return;
    isDown.current = true;
    setPressed(true);
    haptic(8);
    pressEmulatorButton(slot, true);
  }, [slot]);

  const up = useCallback(() => {
    if (!isDown.current) return;
    isDown.current = false;
    setPressed(false);
    pressEmulatorButton(slot, false);
  }, [slot]);

  useEffect(() => {
    const releaseAll = () => up();
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      up();
    };
  }, [up]);

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label ?? "Controller button"}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      /* ---- native touch path (identical to EmulatorJS's own pad handlers) ---- */
      onTouchStart={(e) => {
        e.preventDefault();
        usingTouch.current = true;
        down();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        up();
      }}
      onTouchCancel={(e) => {
        e.preventDefault();
        up();
      }}
      /* ---- pointer path (mouse / stylus only — touch handled above) ---- */
      onPointerDown={(e) => {
        // Ignore if touch events are handling this (iOS fires both)
        if (usingTouch.current || e.pointerType === "touch") return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        down();
      }}
      onPointerUp={(e) => {
        if (usingTouch.current || e.pointerType === "touch") return;
        e.preventDefault();
        up();
      }}
      onPointerCancel={(e) => {
        if (usingTouch.current || e.pointerType === "touch") return;
        up();
      }}
      onLostPointerCapture={(e) => {
        if (usingTouch.current || e.pointerType === "touch") return;
        up();
      }}
      className={cn(
        "pad-touch flex cursor-pointer flex-col items-center justify-center transition-transform duration-75",
        pressed && cn("translate-y-[1.5px] scale-[0.95]", pressedClassName),
        className,
      )}
    >
      {label ? <span>{label}</span> : null}
      {subLabel ? <span className="text-[7px] opacity-75">{subLabel}</span> : null}
    </button>
  );
}

/**
 * Right-wing Diamond X / Y / A / B cluster + stacked START / SELECT buttons
 * for the sideways handheld. Glossy crimson caps on a black carbon panel.
 */
export function RedSidewaysRightCluster({ compact = false }: { compact?: boolean }) {
  const btnSize = compact
    ? "h-[26px] w-[26px] text-[10px]"
    : "h-[34px] w-[34px] text-xs sm:h-[40px] sm:w-[40px] sm:text-[13px]";
  const diamondBox = compact ? "h-[78px] w-[78px]" : "h-[104px] w-[104px] sm:h-[122px] sm:w-[122px]";

  const capStyle =
    "rounded-full border border-[#ff8492]/55 bg-gradient-to-b from-[#f0334c] via-[#b8122a] to-[#6d0715] font-display font-bold text-[#ffe9ec] shadow-[0_4px_8px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,205,210,0.55)]";

  return (
    <div className="flex h-full flex-col items-center justify-between py-1">
      <div className="h-2" />

      {/* 4-button Diamond: X (top), Y (left), A (right — OK), B (bottom — Back) */}
      <div className={cn("relative shrink-0", diamondBox)}>
        <div className="pointer-events-none absolute inset-1.5 rounded-full border border-white/6 bg-[#0d0f13]/85 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]" />

        <PadButton
          slot={RETROPAD.X}
          label="X"
          ariaLabel="X button"
          pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
          className={cn(capStyle, btnSize, "absolute top-0 left-1/2 -translate-x-1/2")}
        />
        <PadButton
          slot={RETROPAD.Y}
          label="Y"
          ariaLabel="Y button"
          pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
          className={cn(capStyle, btnSize, "absolute top-1/2 left-0 -translate-y-1/2")}
        />
        <PadButton
          slot={RETROPAD.A}
          label="A"
          ariaLabel="A button (OK)"
          pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
          className={cn(capStyle, btnSize, "absolute top-1/2 right-0 -translate-y-1/2")}
        />
        <PadButton
          slot={RETROPAD.B}
          label="B"
          ariaLabel="B button (Back)"
          pressedClassName="from-[#ff6b7f] via-[#e01f3b] to-[#9e1024] text-white"
          className={cn(capStyle, btnSize, "absolute bottom-0 left-1/2 -translate-x-1/2")}
        />
      </div>

      {/* Stacked small START & SELECT pills at bottom-right */}
      <div className="flex flex-col items-start gap-2 self-start pl-1 sm:pl-2">
        <div className="flex items-center gap-1.5">
          <PadButton
            slot={RETROPAD.START}
            ariaLabel="Start"
            pressedClassName="bg-[#ff2d4e]"
            className="h-4 w-4 rounded-full border border-[#ff8a97]/55 bg-[#2b070d] shadow-[0_2px_4px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,170,178,0.45)] sm:h-4.5 sm:w-4.5"
          />
          <span className="pad-touch font-mono text-[8px] font-bold tracking-wider text-[#ffb3bb]/85 uppercase sm:text-[9px]">
            START
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <PadButton
            slot={RETROPAD.SELECT}
            ariaLabel="Select"
            pressedClassName="bg-[#ff2d4e]"
            className="h-4 w-4 rounded-full border border-[#ff8a97]/55 bg-[#2b070d] shadow-[0_2px_4px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,170,178,0.45)] sm:h-4.5 sm:w-4.5"
          />
          <span className="pad-touch font-mono text-[8px] font-bold tracking-wider text-[#ffb3bb]/85 uppercase sm:text-[9px]">
            SELECT
          </span>
        </div>
      </div>
    </div>
  );
}

/** Diagonal perforated speaker grille for the vertical handheld. */
export function RedSpeakerGrille() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none grid rotate-[-26deg] grid-cols-6 gap-[4px] opacity-90"
    >
      {Array.from({ length: 30 }).map((_, index) => {
        const corner = index === 0 || index === 5 || index === 24 || index === 29;
        return (
          <span
            key={index}
            className={cn(
              "h-[3.5px] w-[3.5px] rounded-full",
              corner
                ? "opacity-0"
                : "bg-black/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.8),0_0.5px_0_rgba(255,175,180,0.4)]",
            )}
          />
        );
      })}
    </div>
  );
}
