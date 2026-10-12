import clsx from "clsx";
import {
  CircleCheck,
  OctagonAlert,
  TriangleAlert,
  WifiOff,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { Severity, SiteStatus } from "@/lib/domain";

type Tone = SiteStatus | Severity;

const CONFIG: Record<
  Tone,
  { label: string; icon: LucideIcon; className: string }
> = {
  healthy: {
    label: "Healthy",
    icon: CircleCheck,
    className: "bg-primary-soft text-primary-strong border-primary/25",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    className: "bg-warn-soft text-warn border-warn-line",
  },
  critical: {
    label: "Critical",
    icon: OctagonAlert,
    className: "bg-crit-soft text-crit border-crit-line",
  },
  stale: {
    label: "No data",
    icon: WifiOff,
    className: "bg-offline-soft text-offline border-line-strong",
  },
  info: {
    label: "Info",
    icon: Info,
    className: "bg-info-soft text-info border-info-line",
  },
};

/** Status is always conveyed by icon + text, never colour alone. */
export function StatusChip({
  status,
  label,
  className,
}: {
  status: Tone;
  label?: string;
  className?: string;
}) {
  const c = CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold leading-5",
        c.className,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label ?? c.label}
    </span>
  );
}
