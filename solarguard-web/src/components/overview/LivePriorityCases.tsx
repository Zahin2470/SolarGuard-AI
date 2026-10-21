import { ArrowRight, UserRound } from "lucide-react";
import Link from "next/link";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ApiCase } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL } from "@/lib/labels";
import type { CasePipeline } from "@/lib/view";

const SHOWN = 5;

/** Top open cases from the API, in the API's order (severity, then estimated gap). */
export function LivePriorityCases({ cases, pipeline }: { cases: ApiCase[]; pipeline: CasePipeline }) {
  return (
    <div>
      {cases.length === 0 ? (
        <EmptyState title="No open recovery cases">
          Open a case from an alert in Recovery Cases when it is worth a technician&apos;s time.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {cases.slice(0, SHOWN).map((c, idx) => (
            <li key={c.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-label={`Priority rank ${idx + 1}`}
                  className="grid size-6 place-items-center rounded-full bg-pine-900 text-xs font-bold text-white"
                >
                  {idx + 1}
                </span>
                <StatusChip status={c.severity} />
                <span className="text-xs font-medium text-ink-muted">
                  {c.id} · {LIVE_CASE_STATUS_LABEL[c.status]}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-ink">
                <Link href={`/recovery-cases/${c.id}`} className="underline-offset-2 hover:text-primary-strong hover:underline">
                  {c.title}
                </Link>
              </h3>
              <p className="text-xs text-ink-muted">Site {c.site_id}</p>
              <div className="num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  {c.est_gap_kwh === null ? "Gap not estimable" : `${formatNumber(c.est_gap_kwh)} kWh gap`}
                  {c.est_gap_kwh !== null ? <ImpactStatusLabel level="estimated" /> : null}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound aria-hidden className="size-3.5" />
                  {c.owner ?? "Unassigned"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        <span className="font-semibold text-ink">Why this order:</span> severity first, then larger estimated gap. No
        confidence term: no model supplies one yet. Rule to be validated with operators.
      </p>
      {cases.length > SHOWN ? (
        <p className="mt-2 text-sm">
          <Link href="/recovery-cases" className="inline-flex items-center gap-1 font-semibold text-primary-strong underline underline-offset-2">
            All {cases.length} open cases <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">Recovery pipeline</p>
        <p className="num mt-0.5 text-xs text-ink-muted">
          {pipeline.needsReview} need review · {pipeline.actionAssigned} confirmed or assigned · {pipeline.inProgress} in
          progress · {pipeline.resolved} resolved ({pipeline.verified} verified, {pipeline.inconclusive} inconclusive)
        </p>
      </div>
    </div>
  );
}
