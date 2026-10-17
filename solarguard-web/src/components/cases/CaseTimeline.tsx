import type { ApiCaseEvent } from "@/lib/api/types";
import { formatDayTime } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL } from "@/lib/labels";

function describe(e: ApiCaseEvent): string {
  if (e.kind === "transition" && e.to_status) {
    const to = LIVE_CASE_STATUS_LABEL[e.to_status as keyof typeof LIVE_CASE_STATUS_LABEL] ?? e.to_status;
    return `Moved to ${to}`;
  }
  if (e.kind === "created") return "Case opened";
  if (e.kind === "edited") return "Estimates or cause edited";
  if (e.kind === "verification") return "Verification check run";
  return e.kind;
}

export function CaseTimeline({ events }: { events: ApiCaseEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-ink-muted">No events recorded.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line-strong pl-5">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span aria-hidden className="absolute -left-[1.62rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-pine-700" />
          <p className="text-sm font-semibold text-ink">{describe(e)}</p>
          <p className="num text-xs text-ink-muted">
            {formatDayTime(Date.parse(e.at))} · {e.actor}
          </p>
          {e.note ? <p className="mt-0.5 text-sm text-ink-muted">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
