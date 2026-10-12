import clsx from "clsx";
import {
  BadgeCheck,
  CircleDashed,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  HelpCircle,
  Radar,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ImpactLevel } from "@/lib/domain";

const CONFIG: Record<
  ImpactLevel,
  { label: string; meaning: string; icon: LucideIcon; className: string }
> = {
  detected: {
    label: "Detected",
    meaning: "Observed data differs from the model. A signal, not a confirmed fault.",
    icon: Radar,
    className: "border-line-strong bg-surface text-ink-muted border-solid",
  },
  estimated: {
    label: "Estimated",
    meaning: "Calculated from modelled expected output over valid intervals. Not measured savings.",
    icon: Gauge,
    className: "border-info-line bg-info-soft text-info border-dashed",
  },
  potential: {
    label: "Potentially recoverable",
    meaning: "A reasoned estimate that needs validation. Not a verified saving.",
    icon: Sparkles,
    className: "border-primary/40 bg-primary-soft text-primary-strong border-dashed",
  },
  recorded: {
    label: "Action recorded",
    meaning: "An operator documented an action. This shows it was recorded, not that it worked.",
    icon: ClipboardCheck,
    className: "border-line-strong bg-sunken text-ink border-solid",
  },
  measured: {
    label: "Measured change",
    meaning: "Output changed in a defined post-action window. Observed, not necessarily causal.",
    icon: TrendingUp,
    className: "border-pine-700 bg-surface text-pine-800 border-solid",
  },
  verified: {
    label: "Verified",
    meaning: "Supported by a documented comparison method and adequate data.",
    icon: BadgeCheck,
    className: "border-primary bg-primary text-white border-solid",
  },
  not_verified: {
    label: "Not yet verified",
    meaning: "No post-action comparison has been completed.",
    icon: CircleDashed,
    className: "border-line-strong bg-sunken text-ink-muted border-dashed",
  },
  inconclusive: {
    label: "Inconclusive",
    meaning: "Data was available but did not support a defensible conclusion.",
    icon: HelpCircle,
    className: "border-warn-line bg-warn-soft text-warn border-solid",
  },
  demo: {
    label: "Demo data",
    meaning: "Illustrative fixture data. Not a customer result.",
    icon: FlaskConical,
    className: "border-warn-line bg-warn-soft text-warn border-dashed",
  },
};

/**
 * Marks whether a number is detected / estimated / potential / recorded / measured / verified.
 * The meaning is available to assistive tech and as a hover title.
 */
export function ImpactStatusLabel({
  level,
  label,
  className,
}: {
  level: ImpactLevel;
  label?: string;
  className?: string;
}) {
  const c = CONFIG[level];
  const Icon = c.icon;
  return (
    <span
      title={c.meaning}
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-4",
        c.className,
        className,
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      {label ?? c.label}
      <span className="sr-only">. {c.meaning}</span>
    </span>
  );
}
