import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { EvidenceLadder } from "@/components/reports/EvidenceLadder";
import { LedgerTable } from "@/components/reports/LedgerTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { listCases } from "@/lib/api/live";
import { settle } from "@/lib/api/settle";
import { buildLedger } from "@/lib/ledger";

export const metadata: Metadata = { title: "Reports & Impact" };

const DESCRIPTION =
  "Detected gap, potentially recoverable energy, recorded actions and verified improvement, kept strictly apart.";

async function ReportsView() {
  const res = await settle(listCases("newest"));
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Reports & Impact" description={DESCRIPTION} />
        <Panel title="Impact ledger">
          <ApiProblem error={res.error} />
        </Panel>
      </>
    );
  }
  const { rows, totals } = buildLedger(res.value);

  return (
    <>
      <PageHeader
        title="Reports & Impact"
        description={DESCRIPTION}
        meta={<SourceBadge source="api" />}
        action={
          rows.length > 0 ? (
            <a
              href="/reports/export"
              download
              className="inline-flex items-center gap-2 rounded-ctl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
            >
              <Download aria-hidden className="size-4" />
              Download ledger (CSV)
            </a>
          ) : null
        }
      />

      <Panel
        title="Evidence ladder"
        description="Energy only (kWh). Each lane answers a different question; the last is the only claim about what actually happened."
      >
        <EvidenceLadder t={totals} />
      </Panel>

      <Panel title="Case ledger" description="Every figure sits next to its evidence level. Newest cases first.">
        <LedgerTable rows={rows} />
      </Panel>

      <Panel title="Method and limits" description="Read before quoting any number from this page.">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>
            <span className="font-semibold text-ink">Estimated gap:</span> expected minus actual power, times 1 hour, over
            valid production hours in the alert window. It is only as good as the expected-power input.
          </li>
          <li>
            <span className="font-semibold text-ink">Potentially recoverable:</span> the estimated gap times a share a
            person entered with a written reason. Blank until then; never defaulted.
          </li>
          <li>
            <span className="font-semibold text-ink">Verified:</span> the performance ratio (actual ÷ expected) over the 7 days
            before the action versus the 7 days after completion, needing at least 12 valid production hours in each and an
            expected-power baseline supplied independently of the site&apos;s own history. It supports an association, not proof
            of cause. Curtailment, maintenance by others and sensor changes are not visible in this data.
          </li>
          <li>
            <span className="font-semibold text-ink">Post-window energy</span> covers the 7 days after the action only. It is not
            annualised or extrapolated.
          </li>
          <li>
            <span className="font-semibold text-ink">No money or carbon figures.</span> They need a sourced tariff and grid
            emission factor, and none has been provided. Nothing here converts kWh into currency or CO₂.
          </li>
          <li>Rejected cases are shown but excluded from every lane.</li>
        </ul>
      </Panel>
    </>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy="true" aria-label="Loading report">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        }
      >
        <ReportsView />
      </Suspense>
    </div>
  );
}
