/**
 * backup.ts — portable vault archives.
 *
 * A backup is an ordinary .zip: every ROM file plus `localemu_vault_manifest.json`
 * describing core, ratio and title, so a restore does not need to re-detect
 * anything. Restoring writes straight back into the IndexedDB `roms` store.
 */

import JSZip from "jszip";
import type { RomRecord } from "@/lib/db";
import type { CoreId } from "@/lib/rom";

export const MANIFEST_NAME = "localemu_vault_manifest.json";

type ManifestGame = {
  title: string;
  core: CoreId | string;
  coreName: string;
  engine: string;
  ratio: string;
  romFilename: string;
  archiveFile: string;
  sizeBytes: number;
  savedAt: number;
  lastPlayed: number;
};

type Manifest = {
  version: 1;
  app: "LocalEmu";
  username: string;
  exportedAt: string;
  games: ManifestGame[];
};

const slug = (value: string): string => value.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "rom";

export async function buildVaultBackup(roms: RomRecord[], username: string): Promise<Blob> {
  const zip = new JSZip();
  const games: ManifestGame[] = [];

  roms.forEach((rom, index) => {
    const archiveFile = `${String(index + 1).padStart(2, "0")}_${slug(rom.romFilename || `${rom.title}.${rom.core}`)}`;
    zip.file(archiveFile, rom.romBlob);
    games.push({
      title: rom.title,
      core: rom.core,
      coreName: rom.coreName,
      engine: rom.engine,
      ratio: rom.ratio,
      romFilename: rom.romFilename,
      archiveFile,
      sizeBytes: rom.sizeBytes,
      savedAt: rom.savedAt,
      lastPlayed: rom.lastPlayed,
    });
  });

  const manifest: Manifest = {
    version: 1,
    app: "LocalEmu",
    username,
    exportedAt: new Date().toISOString(),
    games,
  };
  zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function readVaultBackup(
  file: File,
  owner: string,
): Promise<Omit<RomRecord, "id">[]> {
  const zip = await JSZip.loadAsync(file);

  // A plain ROM dump folder zipped by hand: fall back to per-file detection.
  const manifestEntry = zip.file(MANIFEST_NAME);
  const records: Omit<RomRecord, "id">[] = [];

  if (manifestEntry) {
    const manifest = JSON.parse(await manifestEntry.async("string")) as Manifest;
    for (const game of manifest.games ?? []) {
      const entry = zip.file(game.archiveFile);
      if (!entry) continue;
      const blob = await entry.async("blob");
      records.push({
        owner,
        title: game.title,
        core: game.core,
        coreName: game.coreName,
        engine: game.engine,
        ratio: game.ratio || "4/3",
        romBlob: blob,
        romFilename: game.romFilename || game.archiveFile,
        sizeBytes: blob.size,
        savedAt: game.savedAt || Date.now(),
        lastPlayed: game.lastPlayed || Date.now(),
        playCount: 0,
      });
    }
    return records;
  }

  const names = Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && !name.includes("__MACOSX") && /\.(zip|gba|gbc|gb|nds|nes|sfc|smc|n64|z64|v64|md|gen|sms|gg|pce|cue|bin|chd)$/i.test(name),
  );
  const { prepareRom } = await import("@/lib/rom");
  for (const name of names) {
    const blob = await zip.files[name].async("blob");
    const pseudo = new File([blob], name.split("/").pop() ?? name, { type: blob.type });
    try {
      const parsed = await prepareRom(pseudo, "auto");
      records.push({
        owner,
        title: parsed.title,
        core: parsed.core,
        coreName: parsed.coreName,
        engine: parsed.engine,
        ratio: parsed.ratio,
        romBlob: parsed.romBlob,
        romFilename: parsed.romFilename,
        sizeBytes: parsed.romBlob.size,
        savedAt: Date.now(),
        lastPlayed: Date.now(),
        playCount: 0,
      });
    } catch {
      /* skip anything we cannot identify */
    }
  }
  return records;
}
