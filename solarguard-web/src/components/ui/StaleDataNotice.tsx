import { Clock } from "lucide-react";
import { formatDayTime, TIME_ZONE } from "@/lib/format";

/** Live data older than the threshold: say so plainly instead of presenting it as current. */
export function StaleDataNotice({ dataThrough, now, thresholdHours }: { dataThrough: number; now: number; thresholdHours: number }) {
  const ageH = (now - dataThrough) / 3_600_000;
  if (ageH <= thresholdHours) return null;
  const age = ageH >= 48 ? `${Math.round(ageH / 24)} days` : `${Math.round(ageH)} hours`;
  return (
    <div role="status" className="flex items-start gap-3 rounded-card border border-warn-line bg-warn-soft/60 px-4 py-3 text-sm text-ink">
      <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
      <p>
        <span className="font-semibold">Latest data is about {age} old.</span> The newest hour received ended{" "}
        <span className="num">{formatDayTime(dataThrough)}</span> ({TIME_ZONE}). Sites with nothing in the last{" "}
        {thresholdHours} hours show as not reporting, and the figures below describe that last period, not the present.
      </p>
    </div>
  );
}
