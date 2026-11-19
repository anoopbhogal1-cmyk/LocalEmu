import { useCallback, useRef, useState } from "react";
import { FileArchive, HardDrive, Smartphone, Tablet, Upload } from "lucide-react";
import { LocalEmuLogo } from "@/components/LocalEmuLogo";
import { Button, Chip, Eyebrow, Panel, StatBlock } from "@/components/ui";
import { ACCEPT_ATTR, formatBytes } from "@/lib/rom";
import { cn } from "@/utils/cn";

const FORMATS = [
  { ext: ".zip", note: "auto-extract", hot: true },
  { ext: ".gba", note: "mGBA · Red Pad" },
  { ext: ".nds", note: "MelonDS · Red Pad" },
  { ext: ".gbc / .gb", note: "Gambatte · Red Pad", hot: true },
  { ext: ".sfc / .smc", note: "Snes9x" },
  { ext: ".nes", note: "Nestopia" },
  { ext: ".n64 / .z64", note: "Mupen64+" },
  { ext: ".md / .gen", note: "Genesis GX" },
  { ext: ".sms / .gg", note: "Genesis GX" },
  { ext: ".cue + .bin", note: "SwanStation", hot: true },
  { ext: ".pce", note: "Mednafen" },
  { ext: ".ngp / .ws", note: "Mednafen" },
];

export function Dropzone({
  onFile,
  romCount,
  saveCount,
  bytesUsed,
  lastBoot,
  signedIn,
}: {
  onFile: (file: File) => void;
  romCount: number;
  saveCount: number;
  bytesUsed: number;
  lastBoot: string | null;
  signedIn: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const accept = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <Panel className="relative overflow-hidden p-0">
      <div className="pointer-events-none absolute inset-0 scanlines opacity-[0.35]" />
      <div className="relative grid gap-0 lg:grid-cols-[1.58fr_1fr]">
        {/* Cartridge & Touch Launcher */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload or drop a .zip or ROM file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            depth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => {
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            depth.current = 0;
            setDragging(false);
            accept(event.dataTransfer.files);
          }}
          className={cn(
            "group cursor-pointer px-5 py-7 transition-colors duration-300 sm:px-10 sm:py-11",
            dragging ? "bg-ember-500/[0.08]" : "hover:bg-white/[0.015]",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(event) => {
              accept(event.target.files);
              event.target.value = "";
            }}
          />

          <div className="flex flex-col items-start gap-5 sm:gap-6">
            {/* Emblem + Cartridge Slot Header */}
            <div className="flex w-full flex-wrap items-center gap-5">
              <div className="relative rounded-full shadow-[0_0_45px_-8px_rgba(77,243,255,0.4)] transition-transform duration-500 group-hover:scale-[1.04]">
                <LocalEmuLogo size={116} showCircuits />
              </div>

              {/* Slot graphic */}
              <div
                className={cn(
                  "relative h-16 min-w-[200px] flex-1 max-w-[340px] overflow-hidden rounded-xl border transition-all duration-500",
                  dragging
                    ? "border-ember-400/80 shadow-[0_0_40px_-8px_rgba(245,158,49,0.65)]"
                    : "border-white/10 group-hover:border-cyan-400/45",
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-cabinet-800 to-cabinet-950" />
                <div className="absolute inset-x-0 top-1/2 h-[7px] -translate-y-1/2 bg-cabinet-950 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]" />
                <div
                  className={cn(
                    "absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2 bg-cyan-300/60 transition-all duration-500",
                    dragging ? "mx-4 opacity-100" : "mx-12 opacity-45",
                  )}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-[10px] tracking-[0.34em] text-ash-400 uppercase">
                    {dragging ? "release to boot" : "insert rom / zip"}
                  </span>
                </div>
              </div>
            </div>

            <div className="max-w-xl">
              <Eyebrow className="flex items-center gap-2">
                <FileArchive className="h-3 w-3 text-cyan-300" />
                desktop · mobile · ipad · 100% client-side
              </Eyebrow>
              <h1 className="mt-2.5 font-display text-[30px] leading-[1.04] font-bold tracking-tight text-vellum sm:text-[44px]">
                Drop or tap any <span className="text-ember-400">.zip</span> or ROM.
                <br />
                Play anywhere, save to your account.
              </h1>
              <p className="mt-3 max-w-[54ch] text-[13px] leading-relaxed text-ash-400 sm:text-[13.5px]">
                Archives unpack in memory. Laptops get a{" "}
                <strong className="text-crt-300">clean screen</strong> with no clutter around it;
                mobile &amp; iPad auto-detect and add red &amp; black tap pads —{" "}
                <strong className="text-[#ff9aa6]">sideways</strong> or{" "}
                <strong className="text-[#ff9aa6]">vertical</strong> to match the console. Keyboard
                uses <strong className="text-ember-300">J (OK) / K (Back)</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                icon={<Upload className="h-4 w-4" />}
                className="px-5 py-3 text-[13px]"
              >
                Select .zip or ROM file
              </Button>
              <span className="font-mono text-[11px] text-ash-500">
                Files app on iPhone &amp; iPad · Drag &amp; drop on Desktop
              </span>
            </div>
          </div>
        </div>

        {/* Support rail */}
        <aside className="flex flex-col gap-5 border-t border-white/7 bg-cabinet-950/45 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <div className="grid grid-cols-2 gap-2.5">
            <StatBlock
              label="cartridges"
              value={romCount}
              sub={signedIn ? `${saveCount} account saves` : "sign in to save"}
            />
            <StatBlock
              label="stored"
              value={formatBytes(bytesUsed)}
              sub={`last boot ${lastBoot ?? "—"}`}
            />
          </div>

          <div>
            <Eyebrow className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-crt-400" />
              accepted formats
            </Eyebrow>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FORMATS.map((format) => (
                <Chip
                  key={format.ext}
                  tone={format.hot ? "ember" : "neutral"}
                  title={`${format.ext} → ${format.note}`}
                  className="transition hover:-translate-y-0.5"
                >
                  {format.ext}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-auto flex items-start gap-2.5 rounded-2xl border border-cyan-400/25 bg-cyan-500/8 p-3.5">
            <div className="mt-0.5 flex shrink-0 items-center gap-1 text-cyan-300">
              <Smartphone className="h-3.5 w-3.5" />
              <Tablet className="h-3.5 w-3.5" />
            </div>
            <p className="text-[11.5px] leading-relaxed text-ash-300">
              Device detection is automatic: laptops and desktops render just the screen, while
              phones and iPads add glossy{" "}
              <strong className="text-[#ff9aa6]">red &amp; black tap pads</strong> with an enlarged
              play area.
            </p>
          </div>
        </aside>
      </div>
    </Panel>
  );
}
