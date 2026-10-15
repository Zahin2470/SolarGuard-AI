import type { Metadata } from "next";
import { AlertList } from "@/components/alerts/AlertList";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getAlerts } from "@/lib/api/alerts";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const { alerts, now } = await getAlerts();
  const open = alerts.filter((a) => a.status !== "closed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Triage detected deviations: what was observed, how strong the evidence is, and the next check."
        meta={
          <>
            <span>{open} open</span>
            <ImpactStatusLabel level="demo" />
          </>
        }
      />
      <Panel
        title="Alert center"
        description="Sorted by severity, then most recent. An alert is a signal to investigate, not a confirmed fault."
      >
        <AlertList alerts={alerts} now={now} />
      </Panel>
    </div>
  );
}
