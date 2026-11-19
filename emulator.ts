/**
 * emulator.ts — EmulatorJS lifecycle, keyboard mapping (J = OK, K = Back),
 * handheld touch input bridge, and per-account save-state snapshots.
 */

import type { CoreId } from "@/lib/rom";

export const EJS_DATA_PATH = "https://cdn.emulatorjs.org/stable/data/";
export const EJS_LOADER_URL = `${EJS_DATA_PATH}loader.js`;

/** Key name → keyCode used by EmulatorJS's keyMap (numeric codes required). */
export const KEY_NAME_TO_CODE: Record<string, number> = {
  j: 74,
  k: 75,
  s: 83,
  a: 65,
  q: 81,
  w: 87,
  enter: 13,
  shift: 16,
  tab: 9,
  r: 82,
  "up arrow": 38,
  "down arrow": 40,
  "left arrow": 37,
  "right arrow": 39,
};

/** EmulatorJS RetroPad slot indices expected by `gameManager.simulateInput(0, slot, 0|1)`. */
export const RETROPAD = {
  B: 0,      // Back / Cancel  → keyboard K
  Y: 1,      // Left face      → keyboard A
  SELECT: 2, // Select         → keyboard Shift
  START: 3,  // Start          → keyboard Enter
  UP: 4,     // D-Pad Up       → ArrowUp
  DOWN: 5,   // D-Pad Down     → ArrowDown
  LEFT: 6,   // D-Pad Left     → ArrowLeft
  RIGHT: 7,  // D-Pad Right    → ArrowRight
  A: 8,      // OK / Confirm   → keyboard J
  X: 9,      // Top face       → keyboard S
  L: 10,     // Left bumper    → keyboard Q
  R: 11,     // Right bumper   → keyboard W
} as const;

export type RetroPadSlot = (typeof RETROPAD)[keyof typeof RETROPAD];

/**
 * Default Player-1 controls with J = A (OK) and K = B (Back).
 * CRITICAL: `value` MUST be the numeric keyCode (EmulatorJS does `value === e.keyCode`),
 * not the string name. String values silently break ALL keyboard input.
 */
export const DEFAULT_CONTROLS_P1: Record<number, { value: number; value2?: string }> = {
  0:  { value: 75, value2: "BUTTON_2" }, // B — Back → K
  1:  { value: 65, value2: "BUTTON_4" }, // Y → A
  2:  { value: 16, value2: "SELECT" },   // Shift
  3:  { value: 13, value2: "START" },    // Enter
  4:  { value: 38, value2: "DPAD_UP" },
  5:  { value: 40, value2: "DPAD_DOWN" },
  6:  { value: 37, value2: "DPAD_LEFT" },
  7:  { value: 39, value2: "DPAD_RIGHT" },
  8:  { value: 74, value2: "BUTTON_1" }, // A — OK → J
  9:  { value: 83, value2: "BUTTON_3" }, // X → S
  10: { value: 81, value2: "LEFT_TOP_SHOULDER" },  // Q
  11: { value: 87, value2: "RIGHT_TOP_SHOULDER" }, // W
  12: { value: 9,  value2: "LEFT_BOTTOM_SHOULDER" },
  13: { value: 82, value2: "RIGHT_BOTTOM_SHOULDER" },
  20: { value: 0,  value2: "RIGHT_STICK_X:+1" },
  21: { value: 0,  value2: "RIGHT_STICK_X:-1" },
  22: { value: 0,  value2: "RIGHT_STICK_Y:+1" },
  23: { value: 0,  value2: "RIGHT_STICK_Y:-1" },
};

const KEY_TO_SLOT: Record<string, RetroPadSlot> = {
  j: RETROPAD.A,
  k: RETROPAD.B,
  s: RETROPAD.X,
  a: RETROPAD.Y,
  q: RETROPAD.L,
  w: RETROPAD.R,
  enter: RETROPAD.START,
  shift: RETROPAD.SELECT,
  arrowup: RETROPAD.UP,
  arrowdown: RETROPAD.DOWN,
  arrowleft: RETROPAD.LEFT,
  arrowright: RETROPAD.RIGHT,
};

type EjsGameManager = {
  simulateInput?: (player: number, index: number, value: number) => void;
  getState?: () => Uint8Array | Promise<Uint8Array>;
  loadState?: (state: Uint8Array) => void | Promise<void>;
  getSaveFile?: () => Uint8Array | Promise<Uint8Array>;
  screenshot?: () => Uint8Array | string | Promise<Uint8Array | string>;
};

declare global {
  interface Window {
    EJS_player?: string;
    EJS_core?: string;
    EJS_gameName?: string;
    EJS_gameUrl?: string;
    EJS_pathtodata?: string;
    EJS_startOnLoaded?: boolean;
    EJS_color?: string;
    EJS_defaultControls?: Record<number, Record<number, { value: number; value2?: string }>>;
    EJS_Buttons?: Record<string, boolean>;
    EJS_defaultOptions?: Record<string, unknown>;
    EJS_language?: string;
    EJS_fullscreenOnLoaded?: boolean;
    EJS_onGameStart?: () => void;
    EJS_onSaveState?: () => void;
    EJS_onLoadState?: () => void;
    EJS_onSaveSram?: () => void;
    EJS_emulator?: {
      pause?: () => void;
      play?: () => void;
      started?: boolean;
      touch?: boolean;
      hasTouchScreen?: boolean;
      controls?: Record<number, Record<number, { value?: number | string; value2?: string }>>;
      defaultControllers?: Record<number, Record<number, { value?: number | string; value2?: string }>>;
      saveSettings?: () => void;
      callEvent?: (event: string, data?: unknown) => void;
      emulator?: { exit?: () => void };
      gameManager?: EjsGameManager;
    };
  }
}

export type EmulatorBoot = {
  gameUrl: string;
  core: CoreId;
  title: string;
  /** Account key so SRAM files are isolated per local user */
  ownerKey?: string;
};

export type EmulatorHandlers = {
  onReady?: () => void;
  onError?: (message: string) => void;
  onSave?: (kind: "saveslot" | "sram") => void;
};

const SCRIPT_ATTR = "data-ejs-loader";

/**
 * Ensure J = A (OK) and K = B (Back).
 *
 * EmulatorJS compares `controls[i][j].value === e.keyCode`, so these MUST be
 * numeric keyCodes (74 / 75), never the "j"/"k" strings — with string values
 * every keyboard press is silently ignored. Applied to both `controls` and
 * `defaultControllers` (user-config reset / core-specific schemes).
 */
export function enforceJKBindings(): void {
  try {
    const emulator = window.EJS_emulator;
    if (!emulator) return;
    const apply = (
      map: Record<number, Record<number, { value?: number | string; value2?: string }>> | undefined,
    ) => {
      if (!map) return;
      const p1 = map[0];
      if (!p1) return;
      const numeric: Record<number, number> = {
        0: 75, // B — Back → K
        1: 65, // Y        → A
        2: 16, // SELECT   → Shift
        3: 13, // START    → Enter
        4: 38, 5: 40, 6: 37, 7: 39,
        8: 74, // A — OK   → J
        9: 83, // X        → S
        10: 81, 11: 87, 12: 9, 13: 82,
        20: 0, 21: 0, 22: 0, 23: 0,
      };
      for (const [slotKey, code] of Object.entries(numeric)) {
        const slot = Number(slotKey);
        const existing = p1[slot];
        if (existing) existing.value = code;
        else if (slot <= 13) p1[slot] = { value: code };
      }
    };
    apply(emulator.controls);
    apply(emulator.defaultControllers);
    emulator.saveSettings?.();
  } catch {
    /* non-fatal */
  }
}

/** Tell EmulatorJS touch mode is active (it gates several input paths on this). */
function markTouchMode(): void {
  const emulator = window.EJS_emulator;
  if (!emulator) return;
  try {
    emulator.touch = true;
    emulator.hasTouchScreen = true;
  } catch {
    /* non-fatal */
  }
}

/** Force any release event (including synthesized touch/click releases) to be a true 0. */
function forceReleasedButton(slot: RetroPadSlot): void {
  const gm = window.EJS_emulator?.gameManager;
  if (gm?.simulateInput) {
    try {
      gm.simulateInput(0, slot, 0);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        gm.simulateInput?.(0, slot, 0);
      } catch {
        /* ignore */
      }
    }, 24);
  }

  // Also dispatch keyup fallback in case simulateInput isn't available
  const key = Object.entries(KEY_TO_SLOT).find(([, value]) => value === slot)?.[0];
  if (key) dispatchKeyboardFallback(key, false);
}

/** Fire KeyboardEvents as a fallback so a press still works even if gameManager isn't ready yet. */
function dispatchKeyboardFallback(key: string, down: boolean): void {
  const code = KEY_NAME_TO_CODE[key];
  if (!code) return;

  // Map internal key names to actual KeyboardEvent.key values
  const keyMap: Record<string, string> = {
    "up arrow": "ArrowUp",
    "down arrow": "ArrowDown",
    "left arrow": "ArrowLeft",
    "right arrow": "ArrowRight",
    enter: "Enter",
    shift: "Shift",
    tab: "Tab",
  };
  const eventKey = keyMap[key] ?? key;
  const eventCode =
    key.length === 1
      ? `Key${key.toUpperCase()}`
      : key === "enter"
        ? "Enter"
        : key === "shift"
          ? "ShiftLeft"
          : key;

  const init: KeyboardEventInit = {
    key: eventKey,
    code: eventCode,
    keyCode: code,
    which: code,
    bubbles: true,
    cancelable: true,
  };
  window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", init));
}

/**
 * Send a button press or release straight into the running libretro core.
 * Mirrors the native virtual-pad handler, which ALSO calls
 * `simulateInput(0, index, 0)` for every release regardless of finger state.
 */
export function pressEmulatorButton(slot: RetroPadSlot, pressed: boolean): void {
  if (!pressed) {
    forceReleasedButton(slot);
    return;
  }
  markTouchMode();
  const gm = window.EJS_emulator?.gameManager;
  let dispatched = false;

  // Primary path: direct WASM simulateInput (fastest, works even when unfocused)
  if (gm?.simulateInput) {
    try {
      gm.simulateInput(0, slot, 1);
      dispatched = true;
    } catch (err) {
      console.warn("[LocalEmu] simulateInput failed, using keyboard fallback", err);
    }
  }

  // Fallback path: dispatch synthetic KeyboardEvent that EmulatorJS keyChange catches
  if (!dispatched) {
    const key = Object.entries(KEY_TO_SLOT).find(([, value]) => value === slot)?.[0];
    if (key) dispatchKeyboardFallback(key, true);
  }
}

/** Capture a thumbnail from the live emulator canvas if WebGL preserveDrawingBuffer allows it. */
function captureCanvasThumbnail(): string | null {
  try {
    const source = document.querySelector<HTMLCanvasElement>("#game canvas");
    if (!source || source.width === 0 || source.height === 0) return null;
    const thumb = document.createElement("canvas");
    const targetW = 200;
    const targetH = Math.max(112, Math.round((source.height / source.width) * targetW));
    thumb.width = targetW;
    thumb.height = targetH;
    const ctx = thumb.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, targetW, targetH);
    return thumb.toDataURL("image/jpeg", 0.76);
  } catch {
    return null;
  }
}

export type CapturedSaveSnapshot = {
  stateBlob: Blob;
  sramBlob: Blob | null;
  screenshotDataUrl: string | null;
  sizeBytes: number;
};

/** Snapshot the live WASM memory state + SRAM so it can be stored in the user's account vault. */
export async function captureAccountSaveSnapshot(): Promise<CapturedSaveSnapshot> {
  const gm = window.EJS_emulator?.gameManager;
  if (!gm?.getState) {
    throw new Error("Wait for the game core to finish booting before saving.");
  }

  const rawState = await Promise.resolve(gm.getState());
  if (!rawState || rawState.byteLength === 0) {
    throw new Error("The running core returned an empty state snapshot.");
  }

  let sramBlob: Blob | null = null;
  if (gm.getSaveFile) {
    try {
      const rawSram = await Promise.resolve(gm.getSaveFile());
      if (rawSram && rawSram.byteLength > 0) {
        sramBlob = new Blob([new Uint8Array(rawSram)], { type: "application/octet-stream" });
      }
    } catch {
      /* optional SRAM snapshot */
    }
  }

  let screenshotDataUrl = captureCanvasThumbnail();
  if (!screenshotDataUrl && gm.screenshot) {
    try {
      const shot = await Promise.resolve(gm.screenshot());
      if (typeof shot === "string" && shot.startsWith("data:image")) {
        screenshotDataUrl = shot;
      } else if (shot instanceof Uint8Array && shot.byteLength > 0) {
        const shotBlob = new Blob([new Uint8Array(shot)], { type: "image/png" });
        screenshotDataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(shotBlob);
        });
      }
    } catch {
      /* thumbnail is optional */
    }
  }

  const stateBytes = new Uint8Array(rawState);
  const stateBlob = new Blob([stateBytes], { type: "application/octet-stream" });
  return {
    stateBlob,
    sramBlob,
    screenshotDataUrl,
    sizeBytes: stateBlob.size + (sramBlob?.size ?? 0),
  };
}

/** Restore a previously captured account save state directly into the running core. */
export async function loadAccountSaveSnapshot(stateBlob: Blob): Promise<void> {
  const gm = window.EJS_emulator?.gameManager;
  if (!gm?.loadState) {
    throw new Error("The emulator core is still booting — try loading in a moment.");
  }
  const buffer = await stateBlob.arrayBuffer();
  await Promise.resolve(gm.loadState(new Uint8Array(buffer)));
}

/** Remove any loader left over from a previous session. */
export function teardownEmulator(): void {
  const emulator = window.EJS_emulator;
  if (emulator) {
    try {
      emulator.pause?.();
      emulator.callEvent?.("exit", []);
      emulator.emulator?.exit?.();
    } catch {
      /* core already gone */
    }
    window.EJS_emulator = undefined;
  }
  document.querySelectorAll(`script[${SCRIPT_ATTR}]`).forEach((node) => node.remove());
  const player = document.getElementById("game");
  if (player) player.innerHTML = "";
}

export function bootEmulator(
  host: HTMLElement,
  boot: EmulatorBoot,
  handlers: EmulatorHandlers = {},
): () => void {
  teardownEmulator();

  host.innerHTML = '<div id="game" class="h-full w-full"></div>';

  const safeTitle = boot.title.replace(/[^\w\-. ()]+/g, "_").slice(0, 48) || "localemu";
  const scopedName = boot.ownerKey ? `${boot.ownerKey}__${safeTitle}` : safeTitle;

  window.EJS_player = "#game";
  window.EJS_core = boot.core;
  window.EJS_gameName = scopedName;
  window.EJS_gameUrl = boot.gameUrl;
  window.EJS_pathtodata = EJS_DATA_PATH;
  window.EJS_startOnLoaded = true;
  window.EJS_color = "#f59e31";
  window.EJS_defaultControls = {
    0: { ...DEFAULT_CONTROLS_P1 },
    1: {},
    2: {},
    3: {},
  };

  window.EJS_onGameStart = () => {
    enforceJKBindings();
    markTouchMode();
    // Re-enforce after a tick to catch any late-loading cached settings
    window.setTimeout(() => {
      enforceJKBindings();
    }, 100);
    handlers.onReady?.();
  };
  window.EJS_onSaveState = () => handlers.onSave?.("saveslot");
  window.EJS_onLoadState = () => handlers.onReady?.();
  window.EJS_onSaveSram = () => handlers.onSave?.("sram");

  // Focus-safe keyboard bridge: J (OK), K (Back), D-Pad, Start/Select, bumpers
  // reach the core even when focus is on a toolbar button or outside the canvas.
  const activeBridgeKeys = new Set<string>();
  const isTypingField = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('[role="dialog"]')) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingField(event.target)) return;
    const key = event.key.toLowerCase();
    const slot = KEY_TO_SLOT[key];
    if (slot === undefined) return;
    event.preventDefault();
    if (!activeBridgeKeys.has(key)) {
      activeBridgeKeys.add(key);
      pressEmulatorButton(slot, true);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (!activeBridgeKeys.has(key)) return;
    activeBridgeKeys.delete(key);
    const slot = KEY_TO_SLOT[key];
    if (slot !== undefined) pressEmulatorButton(slot, false);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const script = document.createElement("script");
  script.src = EJS_LOADER_URL;
  script.async = true;
  script.setAttribute(SCRIPT_ATTR, "true");

  let settled = false;
  const watchdog = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    handlers.onError?.(
      "The EmulatorJS core bundle did not answer. Check the network connection to cdn.emulatorjs.org — the ROM and vault are safe.",
    );
  }, 30_000);

  script.onerror = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(watchdog);
    handlers.onError?.("Could not download the emulator core from cdn.emulatorjs.org.");
  };

  host.appendChild(script);

  return () => {
    settled = true;
    window.clearTimeout(watchdog);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    activeBridgeKeys.forEach((key) => {
      const slot = KEY_TO_SLOT[key];
      if (slot !== undefined) pressEmulatorButton(slot, false);
    });
    activeBridgeKeys.clear();
    window.EJS_onGameStart = undefined;
    window.EJS_onSaveState = undefined;
    window.EJS_onLoadState = undefined;
    window.EJS_onSaveSram = undefined;
    teardownEmulator();
    host.innerHTML = "";
  };
}
