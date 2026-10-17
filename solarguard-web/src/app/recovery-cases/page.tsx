import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriage } from "@/components/cases/AlertTriage";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { CaseQueue } from "@/components/cases/CaseQueue";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { listAlerts, listCases } from "@/lib/api/live";
import { settle } from "@/lib/api/settle";

export const metadata: Metadata = { title: "Recovery Cases" };

async function CaseQueueSection() {
  const res = await settle(listCases("priority"));
  if (!res.ok) return <ApiProblem error={res.error} />;
  return <CaseQueue cases={res.value} />;
}

async function TriageSection() {
  const res = await settle(listAlerts());
  if (!res.ok) return <ApiProblem error={res.error} />;
  return <AlertTriage alerts={res.value.filter((a) => a.case_id === null)} />;
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function RecoveryCasesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Recovery Cases"
        description="Follow each issue from detection to a recorded action to an honest outcome status. Nothing here is counted as recovered energy until a documented comparison supports it."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <Panel
          title="Case queue"
          description="Live records from the SolarGuard API, ranked by priority."
          className="xl:col-span-7"
        >
          <Suspense fallback={<SectionSkeleton />}>
            <CaseQueueSection />
          </Suspense>
        </Panel>

        <Panel
          title="Alerts awaiting triage"
          description="Detected deviations (open or already ended) that have no recovery case yet. Opening a case starts a human review; it is not a confirmed fault."
          className="xl:col-span-5"
        >
          <Suspense fallback={<SectionSkeleton rows={2} />}>
            <TriageSection />
          </Suspense>
        </Panel>
      </div>
    </div>
  );
}
