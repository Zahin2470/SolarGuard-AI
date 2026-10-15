import { EmptyState } from "@/components/ui/States";
import type { ActivityItem } from "@/lib/fixtures";
import { formatAgo, formatDayTime } from "@/lib/format";

export function ActivityFeed({ items, now }: { items: ActivityItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <EmptyState title="No recent activity">
        Case and alert events will be listed here as they happen.
      </EmptyState>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-pine-700 ring-1 ring-line-strong" />
          <p className="text-sm text-ink">{a.text}</p>
          <p className="num mt-0.5 text-xs text-ink-muted">
            {formatDayTime(a.at)} · {formatAgo(a.at, now)}
          </p>
        </li>
      ))}
    </ol>
  );
}
