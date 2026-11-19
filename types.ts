import type { CoreId } from "@/lib/rom";

export type StatusTone = "info" | "success" | "warning" | "error";

export type StatusMessage = {
  text: string;
  tone: StatusTone;
  busy?: boolean;
  action?: { label: string; onTrigger: () => void };
};

export type ActiveSession = {
  id: string;
  title: string;
  core: CoreId;
  coreName: string;
  engine: string;
  ratio: string;
  romBlob: Blob;
  romFilename: string;
  sourceTrail: string;
  sizeBytes: number;
  isSavedInVault: boolean;
  startedAt: number;
};

export type EmulatorPhase = "booting" | "ready" | "error";

export const ASPECT_MODES = [
  { label: "Auto", value: "detected" },
  { label: "Console 4:3", value: "4/3" },
  { label: "Handheld 3:2", value: "3/2" },
  { label: "Widescreen 16:9", value: "16/9" },
  { label: "Square 1:1", value: "1/1" },
] as const;

export type AspectMode = (typeof ASPECT_MODES)[number]["label"];

export type PadMode = "auto" | "sideways" | "vertical" | "cabinet";
