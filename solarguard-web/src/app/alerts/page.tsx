import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertList } from "@/components/alerts/AlertList";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { getAlerts } from "@/lib/api/alerts";
import { settle } from "@/lib/api/settle";

export const metadata: Metadata = { title: "Alerts" };

async function AlertsView() {
  const res = await settle(getAlerts());
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Alerts" description="Triage detected deviations: what was observed, how strong the evidence is, and the next check." />
        <Panel title="Alert center">
          <ApiProblem error={res.error} />
        </Panel>
      </>
    );
  }
  const { alerts, now, source } = res.value;
  const open = alerts.filter((a) => a.status !== "closed").length;
  return (
    <>
      <PageHeader
        title="Alerts"
        description="Triage detected deviations: what was observed, how strong the evidence is, and the next check."
        meta={
          <>
            <span>{open} open</span>
            <SourceBadge source={source} />
          </>
        }
      />
      <Panel
        title="Alert center"
        description="Sorted by severity, then most recent. An alert is a signal to investigate, not a confirmed fault."
      >
        <AlertList alerts={alerts} now={now} />
      </Panel>
    </>
  );
}

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AlertsView />
      </Suspense>
    </div>
  );
}
