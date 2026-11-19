/**
 * rom.ts — archive unpacking + console detection.
 *
 * ZIP archives are inspected entirely in memory with JSZip: the first
 * recognizable ROM entry wins, sidecar files (.txt/.png/.nfo/…) are ignored,
 * and a `.cue` + `.bin` pair is treated as a PlayStation disc image.
 */

import JSZip from "jszip";

export const CORE_IDS = [
  "gba", "gbc", "gb", "nds", "snes", "nes", "n64",
  "segaMD", "segaMS", "segaGG", "psx", "pce",
  "atari2600", "lynx", "ngp", "ws",
] as const;

export type CoreId = (typeof CORE_IDS)[number];
export type ConsoleChoice = "auto" | CoreId;

export type HandheldFormFactor = "vertical" | "sideways";

export type CoreInfo = {
  name: string;
  engine: string;
  ratio: string;
  short: string;
  formFactor: HandheldFormFactor;
  faceButtons: 2 | 4;
};

export const CORE_INFO: Record<CoreId, CoreInfo> = {
  gba:      { name: "Game Boy Advance",          engine: "mGBA",             ratio: "3/2",  short: "GBA",  formFactor: "sideways", faceButtons: 2 },
  gbc:      { name: "Game Boy Color",            engine: "Gambatte",         ratio: "10/9", short: "GBC",  formFactor: "vertical", faceButtons: 2 },
  gb:       { name: "Game Boy",                  engine: "Gambatte",         ratio: "10/9", short: "GB",   formFactor: "vertical", faceButtons: 2 },
  nds:      { name: "Nintendo DS",               engine: "MelonDS",          ratio: "4/3",  short: "NDS",  formFactor: "sideways", faceButtons: 4 },
  snes:     { name: "Super Nintendo",            engine: "Snes9x",           ratio: "4/3",  short: "SNES", formFactor: "sideways", faceButtons: 4 },
  nes:      { name: "Nintendo (NES)",            engine: "Nestopia",         ratio: "4/3",  short: "NES",  formFactor: "sideways", faceButtons: 2 },
  n64:      { name: "Nintendo 64",               engine: "Mupen64Plus-Next", ratio: "4/3",  short: "N64",  formFactor: "sideways", faceButtons: 4 },
  segaMD:   { name: "Sega Genesis / Mega Drive", engine: "Genesis Plus GX",  ratio: "4/3",  short: "GEN",  formFactor: "sideways", faceButtons: 4 },
  segaMS:   { name: "Sega Master System",        engine: "Genesis Plus GX",  ratio: "4/3",  short: "SMS",  formFactor: "sideways", faceButtons: 2 },
  segaGG:   { name: "Sega Game Gear",            engine: "Genesis Plus GX",  ratio: "10/9", short: "GG",   formFactor: "sideways", faceButtons: 2 },
  psx:      { name: "PlayStation",               engine: "SwanStation",      ratio: "4/3",  short: "PSX",  formFactor: "sideways", faceButtons: 4 },
  pce:      { name: "PC Engine / TurboGrafx-16", engine: "Mednafen",         ratio: "10/9", short: "PCE",  formFactor: "sideways", faceButtons: 2 },
  atari2600:{ name: "Atari 2600",                engine: "Stella",           ratio: "4/3",  short: "2600", formFactor: "vertical", faceButtons: 2 },
  lynx:     { name: "Atari Lynx",                engine: "Handy",            ratio: "16/9", short: "LYNX", formFactor: "sideways", faceButtons: 2 },
  ngp:      { name: "Neo Geo Pocket",            engine: "Mednafen",         ratio: "10/9", short: "NGP",  formFactor: "sideways", faceButtons: 2 },
  ws:       { name: "WonderSwan",                engine: "Mednafen",         ratio: "4/3",  short: "WS",   formFactor: "vertical", faceButtons: 2 },
};

export const EXTENSION_CORE_MAP: Record<string, CoreId> = {
  gba: "gba", agb: "gba",
  gbc: "gbc", gb: "gb", dmg: "gb",
  nds: "nds", sds: "nds",
  sfc: "snes", smc: "snes", fig: "snes", swc: "snes",
  nes: "nes", fds: "nes", unif: "nes", unf: "nes",
  n64: "n64", z64: "n64", v64: "n64",
  md: "segaMD", gen: "segaMD", smd: "segaMD",
  sms: "segaMS", gg: "segaGG",
  pce: "pce", a26: "atari2600", lnx: "lynx",
  ngp: "ngp", ngc: "ngp", ws: "ws", wsc: "ws",
  cue: "psx", chd: "psx", pbp: "psx",
};

export const ACCEPT_ATTR =
  ".zip,.gba,.gbc,.gb,.nds,.nes,.fds,.unif,.unf,.sfc,.smc,.fig,.swc,.n64,.z64,.v64,.md,.gen,.smd,.bin,.sms,.gg,.pce,.a26,.lnx,.ngp,.ngc,.ws,.wsc,.cue,.chd,.pbp,.iso";

/** Formats that browser cores can never run — explain instead of failing silently. */
export const UNSUPPORTED_MODERN_EXTS: Record<string, string> = {
  "3ds": "Nintendo 3DS",
  cia: "Nintendo 3DS",
  wbfs: "Nintendo Wii",
  rvz: "Nintendo GameCube / Wii",
  cso: "Sony PSP",
  iso: "Sony PlayStation 2 / PSP",
  pkg: "Sony PlayStation 3",
  xci: "Nintendo Switch",
  nsp: "Nintendo Switch",
};

const SKIP_ENTRY = /\.(txt|pdf|jpg|jpeg|png|gif|nfo|xml|dat|db|html?|md|srt|cmol|dql)$/i;

export class RomError extends Error {
  kind: "unsupported" | "undetected" | "empty" | "error";
  constructor(message: string, kind: RomError["kind"] = "error") {
    super(message);
    this.name = "RomError";
    this.kind = kind;
  }
}

export type RomBundle = {
  title: string;
  core: CoreId;
  coreName: string;
  engine: string;
  ratio: string;
  romBlob: Blob;
  romFilename: string;
  sourceTrail: string;
};

export function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export function cleanTitle(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, "");
  const stripped = base
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || base.replace(/\.[^/.]+$/, "");
}

/** When the extension is ambiguous, fall back to parenthesised set tags in the name. */
export function detectCoreFromName(filename: string): CoreId | null {
  const lower = filename.toLowerCase();
  const rules: [RegExp, CoreId][] = [
    [/\(gba\)|game boy advance/, "gba"],
    [/\(gbc\)|game boy color/, "gbc"],
    [/\(gb\)|game boy(?! (color|advance))/, "gb"],
    [/\(nds\)|nintendo ds|dual screen/, "nds"],
    [/\(snes\)|super nintendo|super famicom/, "snes"],
    [/\(nes\)|nintendo entertainment/, "nes"],
    [/\(n64\)|nintendo 64/, "n64"],
    [/\(md\)|genesis|megadrive|mega drive/, "segaMD"],
    [/\(sms\)|master system/, "segaMS"],
    [/\(gg\)|game gear/, "segaGG"],
    [/\(psx\)|playstation|ps one|ps1/, "psx"],
    [/\(pce\)|pc engine|turbografx/, "pce"],
    [/\(lynx\)/, "lynx"],
    [/\(ngp\)|neo geo pocket/, "ngp"],
    [/\(ws\)|wonderswan/, "ws"],
    [/atari 2600/, "atari2600"],
  ];
  for (const [pattern, core] of rules) if (pattern.test(lower)) return core;
  return null;
}

function resolveCore(ext: string, override: ConsoleChoice, filename: string, size: number): CoreId {
  if (override !== "auto") return override;
  const byExt = EXTENSION_CORE_MAP[ext];
  if (byExt) return byExt;
  const byName = detectCoreFromName(filename);
  if (byName) return byName;
  if (ext === "bin") return size > 15 * 1024 * 1024 ? "psx" : "segaMD";
  throw new RomError(
    `Could not auto-detect a core for “.${ext || "?"}”. Pick the system in the header selector and drop it again.`,
    "undetected",
  );
}

function bundle(
  core: CoreId,
  romBlob: Blob,
  romFilename: string,
  sourceTrail: string,
  titleSource = romFilename,
): RomBundle {
  const info = CORE_INFO[core];
  return {
    core,
    coreName: info.name,
    engine: info.engine,
    ratio: info.ratio,
    title: cleanTitle(titleSource),
    romBlob,
    romFilename,
    sourceTrail,
  };
}

export async function inspectZip(file: File, override: ConsoleChoice): Promise<RomBundle> {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && !name.includes("__MACOSX") && !/\.DS_Store$/i.test(name),
  );

  for (const name of names) {
    const ext = getExtension(name);
    if (UNSUPPORTED_MODERN_EXTS[ext]) {
      throw new RomError(
        `${name.split("/").pop()} is a .${ext} image for ${UNSUPPORTED_MODERN_EXTS[ext]} — no browser core can run it yet.`,
        "unsupported",
      );
    }
  }

  const candidates = names.filter((name) => !SKIP_ENTRY.test(name));
  if (candidates.length === 0) {
    throw new RomError("That archive contains no readable ROM file.", "empty");
  }

  const cueName = candidates.find((name) => getExtension(name) === "cue");
  const binName = candidates.find((name) => getExtension(name) === "bin");

  // Disc image: EmulatorJS wants the whole archive so sidecar files resolve.
  if (cueName && binName) {
    const core = override === "auto" ? "psx" : override;
    return bundle(core, file, file.name, `${file.name} → ${cueName.split("/").pop()}`, file.name);
  }

  /** Read the uncompressed size JSZip keeps on its private metadata object. */
  const sizeOf = (name: string): number => {
    const meta = zip.files[name] as unknown as { _data?: { uncompressedSize?: number } };
    return meta?._data?.uncompressedSize ?? 0;
  };

  const sorted = [...candidates].sort((a, b) => {
    const aKnown = EXTENSION_CORE_MAP[getExtension(a)] ? 1 : 0;
    const bKnown = EXTENSION_CORE_MAP[getExtension(b)] ? 1 : 0;
    if (aKnown !== bKnown) return bKnown - aKnown;
    return sizeOf(b) - sizeOf(a);
  });

  for (const name of sorted) {
    const ext = getExtension(name);
    let core: CoreId | null = null;
    try {
      core = resolveCore(ext, override, name, 0);
    } catch {
      continue;
    }
    const blob = await zip.files[name].async("blob");
    return bundle(core, blob, name.split("/").pop() ?? name, `${file.name} → ${name}`);
  }

  throw new RomError(
    `Nothing runnable inside ${file.name}. Select the console in the header to force a core.`,
    "undetected",
  );
}

export function inspectRawFile(file: File, override: ConsoleChoice): RomBundle {
  const ext = getExtension(file.name);
  const unsupported = UNSUPPORTED_MODERN_EXTS[ext];
  if (unsupported) {
    throw new RomError(
      `${file.name} is a .${ext} image for ${unsupported} — no browser core can run it yet.`,
      "unsupported",
    );
  }
  const core = resolveCore(ext, override, file.name, file.size);
  return bundle(core, file, file.name, file.name);
}

export async function prepareRom(file: File, override: ConsoleChoice): Promise<RomBundle> {
  return getExtension(file.name) === "zip" ? inspectZip(file, override) : inspectRawFile(file, override);
}

/* ------------------------------ formatting --------------------------- */

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRelative(timestamp?: number | null): string {
  if (!timestamp) return "never";
  const diff = Date.now() - timestamp;
  if (diff < 0) return "just now";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
