import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { StatusMessage } from "@/types";
import { cn } from "@/utils/cn";

const TONES = {
  info: {
    wrap: "border-ember-400/30 bg-ember-500/10 text-ember-200",
    icon: Info,
    iconClass: "text-ember-400",
  },
  success: {
    wrap: "border-crt-400/30 bg-crt-500/10 text-crt-300",
    icon: CheckCircle2,
    iconClass: "text-crt-400",
  },
  warning: {
    wrap: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    icon: AlertTriangle,
    iconClass: "text-amber-300",
  },
  error: {
    wrap: "border-berry-400/35 bg-berry-500/12 text-rose-100",
    icon: XCircle,
    iconClass: "text-berry-400",
  },
} as const;

export function StatusBanner({
  status,
  onDismiss,
}: {
  status: StatusMessage | null;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!status) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status.busy) return;
    const timer = window.setTimeout(() => setVisible(false), 14_000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!status || !visible) return null;

  const tone = TONES[status.tone];
  const Icon = tone.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "animate-boot-line flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-300",
        tone.wrap,
        !visible && "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icon className={cn("h-4 w-4 shrink-0", tone.iconClass)} />
        {status.busy ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        <p className="text-[13px] leading-snug font-medium text-balance">{status.text}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {status.action ? (
          <button
            type="button"
            onClick={status.action.onTrigger}
            className="cursor-pointer rounded-xl bg-ember-500 px-3 py-1.5 text-[11px] font-bold text-cabinet-950 transition hover:bg-ember-400"
          >
            {status.action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="cursor-pointer rounded-lg p-1.5 opacity-70 transition hover:bg-black/40 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
