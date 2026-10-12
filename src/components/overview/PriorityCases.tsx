import { ArrowRight, UserRound } from "lucide-react";
import { EmptyState } from "@/components/ui/States";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { StatusChip } from "@/components/ui/StatusChip";
import { confidenceBand, type CaseStatus } from "@/lib/domain";
import type { FleetOverview } from "@/lib/api/fleet";
import { formatNumber } from "@/lib/format";

const STATUS_LABEL: Record<CaseStatus, string> = {
  needs_review: "Needs review",
  confirmed: "Confirmed",
  action_assigned: "Action assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function PriorityCases({
  cases,
  pipeline,
}: {
  cases: FleetOverview["rankedCases"];
  pipeline: FleetOverview["pipeline"];
}) {
  if (cases.length === 0) {
    return (
      <EmptyState title="No open recovery cases">
        Cases appear here when an alert is confirmed as worth a technician&apos;s time.
      </EmptyState>
    );
  }

  return (
    <div>
      <ol className="space-y-3">
        {cases.map((c, idx) => (
          <li
            key={c.id}
            className={
              idx === 0
                ? "rounded-lg border border-crit-line bg-crit-soft/40 p-4"
                : "rounded-lg border border-line bg-surface p-4"
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-label={`Priority rank ${idx + 1}`}
                className="grid size-6 place-items-center rounded-full bg-pine-900 text-xs font-bold text-white"
              >
                {idx + 1}
              </span>
              <StatusChip status={c.severity} />
              <span className="text-xs font-medium text-ink-muted">
                {c.id} · {STATUS_LABEL[c.status]}
              </span>
            </div>

            <h3 className="mt-2 text-sm font-semibold text-ink">
              {c.siteName}: {c.title}
            </h3>

            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted marker:text-line-strong">
              {c.evidence.slice(0, 2).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>

            <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="mb-1 text-ink-muted">Estimated gap, 24 h</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  {c.estimatedGapKwh24h === null ? (
                    <span className="font-semibold text-ink">Not estimable</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-ink">
                        {formatNumber(c.estimatedGapKwh24h)} kWh
                      </span>
                      <ImpactStatusLabel level="estimated" />
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-ink-muted">Potentially recoverable</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  {c.recoverableKwhPerDay === null ? (
                    <span className="font-semibold text-ink">Insufficient data</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-ink">
                        {formatNumber(c.recoverableKwhPerDay)} kWh/day
                      </span>
                      <ImpactStatusLabel level="potential" label="Potential" />
                    </>
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-3 flex items-start gap-1.5 text-sm text-ink">
              <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-semibold">Next check: </span>
                {c.nextAction}
              </span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
              <span>
                Confidence:{" "}
                <span className="font-semibold text-ink">
                  {confidenceBand(c.confidence)} ({Math.round(c.confidence * 100)}%)
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound aria-hidden className="size-3.5" />
                {c.owner ?? "Unassigned"}
              </span>
              <ImpactStatusLabel
                level={c.verification === "not_verifiable" ? "inconclusive" : "not_verified"}
                label={c.verification === "not_verifiable" ? "Not verifiable yet" : "Outcome not yet verified"}
              />
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-ink-muted">
        <span className="font-semibold text-ink">Why this order:</span> severity first, then
        confidence × potentially recoverable energy. Demo rule with no tuned weights; to be validated
        with operators.
      </p>

      <div className="mt-4 rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">Recovery pipeline</p>
        <p className="num mt-0.5 text-xs text-ink-muted">
          {pipeline.needsReview} need review · {pipeline.actionAssigned} action assigned ·{" "}
          {pipeline.inProgress} in progress · {pipeline.resolved} resolved
          ({pipeline.verified} verified, {pipeline.inconclusive} inconclusive)
        </p>
      </div>
    </div>
  );
}
