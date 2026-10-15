import type { Metadata } from "next";
import { SitesTable } from "@/components/overview/SitesTable";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getSites } from "@/lib/api/sites";
import { TIME_ZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const { sites, now } = await getSites();
  const needAttention = sites.filter((s) => s.status !== "healthy").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Every monitored site with its latest status. Open a site for its performance, data quality and history."
        meta={
          <>
            <span>
              {sites.length} sites · {needAttention} need attention · {TIME_ZONE}
            </span>
            <ImpactStatusLabel level="demo" />
          </>
        }
      />
      <Panel title="All sites" description="Last 24 hours, valid intervals only.">
        <SitesTable sites={sites} now={now} />
      </Panel>
    </div>
  );
}
