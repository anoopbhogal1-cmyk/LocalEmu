import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  HardDriveDownload,
  Loader2,
  Lock,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Led } from "@/components/ui";
import { formatBytes, formatRelative } from "@/lib/rom";
import type { PublicUser } from "@/lib/auth";
import type { AccountSaveRecord, SaveSlotId } from "@/lib/db";
import { cn } from "@/utils/cn";

const SLOTS: { id: SaveSlotId; label: string }[] = [
  { id: "quick", label: "Quick Save" },
  { id: "slot-1", label: "Slot 01" },
  { id: "slot-2", label: "Slot 02" },
  { id: "slot-3", label: "Slot 03" },
];

export function AccountSaveControl({
  user,
  savesForGame,
  coreReady,
  compact = false,
  onSaveSlot,
  onLoadSave,
  onDeleteSave,
  onRequestSignIn,
}: {
  user: PublicUser | null;
  savesForGame: AccountSaveRecord[];
  coreReady: boolean;
  compact?: boolean;
  onSaveSlot: (slot: SaveSlotId, label: string) => Promise<void>;
  onLoadSave: (record: AccountSaveRecord) => Promise<void>;
  onDeleteSave: (record: AccountSaveRecord) => Promise<void>;
  onRequestSignIn: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [drawerOpen]);

  const latestSave = savesForGame[0] ?? null;

  const triggerSave = async (slot: SaveSlotId, label: string) => {
    if (busySlot) return;
    setBusySlot(slot);
    try {
      await onSaveSlot(slot, label);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
    } finally {
      setBusySlot(null);
    }
  };

  const triggerLoad = async (record: AccountSaveRecord) => {
    if (busySlot) return;
    setBusySlot(`load-${record.id}`);
    try {
      await onLoadSave(record);
      setDrawerOpen(false);
    } finally {
      setBusySlot(null);
    }
  };

  if (!user) {
    return (
      <button
        type="button"
        onClick={onRequestSignIn}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ember-400/35 bg-ember-500/12 font-semibold text-ember-300 transition hover:border-ember-400/70 hover:bg-ember-500/20",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs",
        )}
      >
        <Lock className="h-3.5 w-3.5 text-ember-400" />
        <span>Sign in for Account Save</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1.5">
      {/* Primary glowing Account Save capsule */}
      <div
        className={cn(
          "inline-flex items-stretch overflow-hidden rounded-xl border transition-all duration-300",
          justSaved
            ? "save-flash border-crt-400 bg-gradient-to-r from-crt-500/30 via-crt-500/20 to-cabinet-850 shadow-[0_0_28px_-4px_rgba(77,216,194,0.75)]"
            : "border-cyan-400/45 bg-gradient-to-r from-[#13293d] via-[#1b1f38] to-[#2d1736] shadow-[0_10px_28px_-10px_rgba(77,243,255,0.45)] hover:border-cyan-300/80",
        )}
      >
        <button
          type="button"
          disabled={!coreReady || Boolean(busySlot)}
          onClick={() => void triggerSave("quick", "Quick Save")}
          title={`Save live game progress directly into @${user.username}'s account`}
          className={cn(
            "group inline-flex cursor-pointer items-center gap-2 font-bold tracking-tight text-vellum transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
            compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs",
          )}
        >
          {busySlot === "quick" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
          ) : justSaved ? (
            <Check className="h-3.5 w-3.5 text-crt-300" />
          ) : (
            <span className="relative flex h-4 w-4 items-center justify-center rounded-md bg-cyan-400/20 text-cyan-300 group-hover:bg-cyan-400/30">
              <Save className="h-3 w-3" />
            </span>
          )}

          <span className="flex flex-col items-start leading-none">
            <span className="flex items-center gap-1.5">
              <span>
                {justSaved
                  ? `Saved to @${user.username}`
                  : compact
                    ? `Save · @${user.username}`
                    : `Save to @${user.username}`}
              </span>
              <Led tone={justSaved ? "crt" : "ember"} className="h-1.5 w-1.5" />
            </span>
            {!compact ? (
              <span className="mt-0.5 font-mono text-[9.5px] font-normal text-cyan-200/75">
                {latestSave ? `last ${formatRelative(latestSave.savedAt)}` : "account state chip"}
              </span>
            ) : null}
          </span>
        </button>

        {/* Slot drawer toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-label="Open account save slots"
          title="Manage account save slots & load state"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 border-l border-white/12 bg-black/25 font-mono text-[10px] font-semibold text-cyan-200 transition hover:bg-white/10",
            compact ? "px-2 py-1.5" : "px-2.5 py-2",
          )}
        >
          <span>{savesForGame.length}/4</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", drawerOpen && "rotate-180")}
          />
        </button>
      </div>

      {/* Quick Load button right beside it if this account already has a save */}
      {latestSave ? (
        <button
          type="button"
          disabled={!coreReady || Boolean(busySlot)}
          onClick={() => void triggerLoad(latestSave)}
          title={`Restore latest @${user.username} save (${formatRelative(latestSave.savedAt)})`}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-crt-400/35 bg-crt-500/14 font-semibold text-crt-300 transition hover:border-crt-300/65 hover:bg-crt-500/24 disabled:opacity-50",
            compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
          )}
        >
          {busySlot === `load-${latestSave.id}` ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HardDriveDownload className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Load</span>
        </button>
      ) : null}

      {/* Account Save Slots Popover */}
      {drawerOpen ? (
        <div className="animate-boot-line absolute top-full right-0 z-50 mt-2 w-[310px] overflow-hidden rounded-2xl border border-cyan-400/30 bg-cabinet-900/98 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:w-[340px]">
          <div className="flex items-center justify-between border-b border-white/8 bg-gradient-to-r from-cyan-500/12 via-transparent to-pink-500/12 px-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 font-display text-xs font-bold text-vellum">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />@{user.username}&apos;s Account
                Saves
              </p>
              <p className="font-mono text-[10px] text-ash-400">
                Private to this account · IndexedDB saves store
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/6 p-2">
            {SLOTS.map((slot) => {
              const record = savesForGame.find((item) => item.slot === slot.id);
              const isSaving = busySlot === slot.id;
              const isLoading = record && busySlot === `load-${record.id}`;

              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl p-2 transition hover:bg-white/[0.03]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-cabinet-950">
                      {record?.screenshotDataUrl ? (
                        <img
                          src={record.screenshotDataUrl}
                          alt={slot.label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[9px] text-ash-500">
                          {record ? "SAVED" : "EMPTY"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-xs font-bold text-vellum">
                        {slot.label}
                      </p>
                      <p className="truncate font-mono text-[10px] text-ash-500">
                        {record
                          ? `${formatRelative(record.savedAt)} · ${formatBytes(record.sizeBytes)}`
                          : "No state recorded"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={!coreReady || Boolean(busySlot)}
                      onClick={() => void triggerSave(slot.id, slot.label)}
                      className="cursor-pointer rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-cyan-200 transition hover:bg-cyan-500/28 disabled:opacity-45"
                    >
                      {isSaving ? "…" : "Save"}
                    </button>
                    {record ? (
                      <>
                        <button
                          type="button"
                          disabled={!coreReady || Boolean(busySlot)}
                          onClick={() => void triggerLoad(record)}
                          className="cursor-pointer rounded-lg border border-crt-400/35 bg-crt-500/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-crt-300 transition hover:bg-crt-500/28 disabled:opacity-45"
                        >
                          {isLoading ? "…" : "Load"}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busySlot)}
                          onClick={() => void onDeleteSave(record)}
                          title="Delete slot"
                          className="cursor-pointer rounded-lg border border-white/8 bg-cabinet-850 p-1.5 text-ash-400 transition hover:border-berry-400/45 hover:text-berry-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
