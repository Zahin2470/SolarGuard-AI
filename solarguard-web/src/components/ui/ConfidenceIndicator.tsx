import { confidenceBand } from "@/lib/domain";

/** Confidence shown as text + a bar, so it never depends on colour alone. */
export function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <p className="num text-sm font-semibold text-ink">
        {confidenceBand(value)} ({pct}%)
      </p>
      <div
        role="meter"
        aria-label="Model confidence in the candidate cause"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-1.5 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-pine-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
