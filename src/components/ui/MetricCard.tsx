import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** KPI card: one label, one value with unit, one line of context. */
export function MetricCard({
  label,
  value,
  unit,
  context,
  badge,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  context?: ReactNode;
  badge?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "attention";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            tone === "attention"
              ? "bg-warn-soft text-warn"
              : "bg-primary-soft text-primary-strong",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="num mt-2 flex items-baseline gap-1.5 text-3xl font-semibold tracking-tight text-ink">
        {value}
        {unit ? (
          <span className="text-sm font-medium text-ink-muted">{unit}</span>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {badge}
        {context ? <span>{context}</span> : null}
      </div>
    </>
  );

  const classes =
    "block rounded-card border border-line bg-surface p-4 shadow-card";

  if (href) {
    return (
      <a
        href={href}
        className={clsx(
          classes,
          "transition-colors hover:border-line-strong hover:bg-canvas/60",
        )}
      >
        {body}
      </a>
    );
  }
  return <div className={classes}>{body}</div>;
}
