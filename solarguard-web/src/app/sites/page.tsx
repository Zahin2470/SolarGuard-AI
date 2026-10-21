import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { SitesTable } from "@/components/overview/SitesTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { settle } from "@/lib/api/settle";
import { getSites } from "@/lib/api/sites";
import { TIME_ZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Sites" };

const DESCRIPTION =
  "Every monitored site with its latest status. Open a site for its performance, data quality and history.";

async function SitesView() {
  const res = await settle(getSites());
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Sites" description={DESCRIPTION} />
        <Panel title="All sites">
          <ApiProblem error={res.error} />
        </Panel>
      </>
    );
  }
  const { sites, now, source } = res.value;
  const needAttention = sites.filter((s) => s.status !== "healthy").length;
  return (
    <>
      <PageHeader
        title="Sites"
        description={DESCRIPTION}
        meta={
          <>
            <span>
              {sites.length} sites · {needAttention} need attention · {TIME_ZONE}
            </span>
            <SourceBadge source={source} />
          </>
        }
      />
      <Panel title="All sites" description="Latest 24 hours of data, valid intervals only.">
        <SitesTable sites={sites} now={now} />
      </Panel>
    </>
  );
}

export default function SitesPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SitesView />
      </Suspense>
    </div>
  );
}
