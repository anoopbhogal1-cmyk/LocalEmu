import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

/* ------------------------------- Panel -------------------------------- */

export function Panel({
  className,
  children,
  as: Tag = "section",
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag className={cn("panel rounded-[26px] backdrop-blur-[2px]", className)}>{children}</Tag>
  );
}

/* ------------------------------- Reveal ------------------------------- */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", shown && "reveal-in", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Eyebrow ------------------------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.28em] text-ash-500",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Led({ tone = "crt", className }: { tone?: "crt" | "ember" | "ash" | "berry"; className?: string }) {
  const tones = {
    crt: "bg-crt-400 shadow-[0_0_10px_rgba(77,216,194,0.7)]",
    ember: "bg-ember-400 shadow-[0_0_10px_rgba(255,185,92,0.7)]",
    ash: "bg-ash-500 shadow-[0_0_6px_rgba(109,118,129,0.5)]",
    berry: "bg-berry-400 shadow-[0_0_10px_rgba(255,107,129,0.6)]",
  } as const;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full animate-led",
        tones[tone],
        className,
      )}
    />
  );
}

/* ------------------------------ Button -------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({
  variant = "quiet",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      "bg-ember-500 text-cabinet-950 font-bold hover:bg-ember-400 shadow-[0_10px_30px_-14px_rgba(245,158,49,0.9)] border border-ember-400/40",
    quiet:
      "bg-cabinet-800 text-ash-200 border border-white/8 hover:border-ember-400/45 hover:text-vellum hover:bg-cabinet-750",
    outline:
      "bg-transparent text-ember-300 border border-ember-400/35 hover:bg-ember-500/12 hover:border-ember-400/60",
    danger:
      "bg-berry-500/12 text-berry-400 border border-berry-500/35 hover:bg-berry-500/22 hover:text-white",
    success: "bg-crt-500/14 text-crt-300 border border-crt-500/35 hover:bg-crt-500/24",
  } as const;

  const sizes = {
    sm: "px-3 py-1.5 text-[11px] gap-1.5 rounded-xl",
    md: "px-4 py-2.5 text-xs gap-2 rounded-2xl",
  } as const;

  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-200",
        "active:translate-y-[1px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* -------------------------------- Chip -------------------------------- */

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "ember" | "crt" | "berry";
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: "bg-cabinet-800/90 text-ash-300 border-white/8",
    ember: "bg-ember-500/12 text-ember-300 border-ember-400/30",
    crt: "bg-crt-500/12 text-crt-300 border-crt-400/30",
    berry: "bg-berry-500/12 text-berry-400 border-berry-500/30",
  } as const;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ StatBlock ----------------------------- */

export function StatBlock({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel-quiet rounded-2xl px-4 py-3.5", className)}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1.5 font-display text-2xl leading-none font-bold text-vellum tabular-nums">{value}</p>
      {sub ? <p className="mt-1.5 font-mono text-[10px] text-ash-500">{sub}</p> : null}
    </div>
  );
}
