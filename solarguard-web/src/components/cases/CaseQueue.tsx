"use client";

import clsx from "clsx";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import type { ApiCase } from "@/lib/api/types";
import { formatDayTime, formatNumber } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL, OPEN_CASE_STATUSES } from "@/lib/labels";

type Filter = "open" | "review" | "action" | "resolved" | "rejected" | "all";

const FILTERS: { id: Filter; label: string; match: (c: ApiCase) => boolean }[] = [
  { id: "open", label: "Open", match: (c) => OPEN_CASE_STATUSES.includes(c.status) },
  { id: "review", label: "Needs review", match: (c) => c.status === "needs_review" || c.status === "inconclusive" },
  {
    id: "action",
    label: "In action",
    match: (c) => c.status === "confirmed" || c.status === "action_assigned" || c.status === "in_progress",
  },
  { id: "resolved", label: "Resolved", match: (c) => c.status === "resolved" },
  { id: "rejected", label: "Rejected", match: (c) => c.status === "rejected" },
  { id: "all", label: "All", match: () => true },
];

/** `cases` arrive already ranked by the API (severity, then estimated gap). */
export function CaseQueue({ cases }: { cases: ApiCase[] }) {
  const [filter, setFilter] = useState<Filter>("open");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, cases.filter(f.match).length])) as Record<Filter, number>,
    [cases],
  );
  const active = FILTERS.find((f) => f.id === filter)!;
  const rows = useMemo(() => cases.filter(active.match), [cases, active]);
  const ranked = filter === "open" || filter === "review" || filter === "action";

  return (
    <div>
      <div role="group" aria-label="Filter cases by status" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              filter === f.id
                ? "border-pine-900 bg-pine-900 text-white"
                : "border-line-strong bg-surface text-ink-muted hover:text-ink",
            )}
          >
            {f.label} <span className="num opacity-80">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No cases match this filter">
          {cases.length === 0
            ? "No recovery cases exist yet. Open one from an alert in the panel below."
            : "Try another filter."}
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {rows.map((c, idx) => (
            <li key={c.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                {ranked ? (
                  <span
                    aria-label={`Priority rank ${idx + 1}`}
                    className="grid size-6 place-items-center rounded-full bg-pine-900 text-xs font-bold text-white"
                  >
                    {idx + 1}
                  </span>
                ) : null}
                <StatusChip status={c.severity} />
                <span className="text-xs font-medium text-ink-muted">
                  {c.id} · {LIVE_CASE_STATUS_LABEL[c.status]}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-semibold text-ink">
                <Link
                  href={`/recovery-cases/${c.id}`}
                  className="underline-offset-2 hover:text-primary-strong hover:underline"
                >
                  {c.title}
                </Link>
              </h3>
              <p className="num text-xs text-ink-muted">
                Site {c.site_id} · opened {formatDayTime(Date.parse(c.created_at))}
              </p>

              <dl className="num mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="mb-1 text-ink-muted">Estimated gap, alert window</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {c.est_gap_kwh === null ? (
                      <span className="font-semibold text-ink">Not estimable</span>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-ink">{formatNumber(c.est_gap_kwh)} kWh</span>
                        <ImpactStatusLabel level="estimated" />
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-ink-muted">Potentially recoverable</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {c.recoverable_kwh === null ? (
                      <span className="font-semibold text-ink">Not estimated yet</span>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-ink">{formatNumber(c.recoverable_kwh)} kWh</span>
                        <ImpactStatusLabel level="potential" label="Potential" />
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <UserRound aria-hidden className="size-3.5" />
                  {c.owner ?? "Unassigned"}
                </span>
                {c.status === "resolved" ? <VerificationLabel status={c.verification_status} /> : null}
                {c.action_taken ? <ImpactStatusLabel level="recorded" /> : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {ranked ? (
        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-semibold text-ink">Why this order:</span> severity first, then larger estimated gap.
          There is no confidence term because no model supplies one yet. Rule to be validated with operators.
        </p>
      ) : null}
    </div>
  );
}
