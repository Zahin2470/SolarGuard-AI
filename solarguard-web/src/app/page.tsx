import type { Metadata } from "next";
import {
  Activity,
  BatteryCharging,
  LifeBuoy,
  MapPinned,
  ShieldAlert,
} from "lucide-react";
import { ActivityFeed } from "@/components/overview/ActivityFeed";
import { PriorityCases } from "@/components/overview/PriorityCases";
import { PowerChart } from "@/components/overview/PowerChart";
import { SitesTable } from "@/components/overview/SitesTable";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getFleetOverview } from "@/lib/api/fleet";
import { formatDayTime, formatNumber, formatPct, formatTime, TIME_ZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Fleet Overview" };

export default async function FleetOverviewPage() {
  const o = await getFleetOverview();
  const { kpis, data } = o;
  const dataThrough = kpis.latestFleetAt + 3_600_000; // end of the last complete interval
  const gap = kpis.energy24h;
  const staleSites = data.sites.filter((s) => s.status === "stale").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Overview"
        description="Which sites need attention, how strong the evidence is, and what to check next."
        meta={
          <>
            <span>
              {kpis.sitesTotal} sites · {TIME_ZONE}
            </span>
            <span className="num">
              Data through {formatDayTime(dataThrough)}
              {staleSites > 0 ? ` · ${staleSites} site not reporting` : ""}
            </span>
            <ImpactStatusLabel level="demo" />
          </>
        }
        action={
          <a
            href="#priority-cases"
            className="inline-flex items-center gap-2 rounded-ctl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            <LifeBuoy aria-hidden className="size-4" />
            Review priority cases
          </a>
        }
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Monitored sites"
          icon={MapPinned}
          value={String(kpis.sitesTotal)}
          context={`${kpis.sitesReporting} of ${kpis.sitesTotal} reporting in the latest hour`}
        />
        <MetricCard
          label="Fleet power, latest hour"
          icon={Activity}
          value={formatNumber(kpis.latestFleetKw)}
          unit="kW"
          context={`Expected ${formatNumber(kpis.expectedFleetKwAtLatest)} kW · hour to ${formatTime(dataThrough)}`}
        />
        <MetricCard
          label="Energy, last 24 h"
          icon={BatteryCharging}
          value={formatNumber(gap.actualKwh)}
          unit="kWh"
          badge={<ImpactStatusLabel level="estimated" label={`Gap ${formatNumber(gap.gapKwh)} kWh (${gap.gapPct === null ? "n/a" : formatPct(gap.gapPct)})`} />}
          context={`Expected ${formatNumber(gap.expectedKwh)} kWh`}
        />
        <MetricCard
          label="Sites needing attention"
          icon={ShieldAlert}
          tone="attention"
          value={String(kpis.sitesNeedingAttention)}
          context="Critical, warning or not reporting"
          href="#sites"
        />
        <MetricCard
          label="Open recovery cases"
          icon={LifeBuoy}
          value={String(kpis.openCases)}
          context={`${kpis.casesNeedingReview} need review · 0 outcomes verified`}
          href="#priority-cases"
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <Panel
            title="Actual vs expected production"
            description="Fleet total. Expected power comes from the demo baseline model."
          >
            <PowerChart subject="Fleet" points={data.series} sitesTotal={data.sitesTotal} />
          </Panel>

          <Panel title="Recent activity">
            <ActivityFeed items={data.activity} now={o.now} />
          </Panel>
        </div>

        <Panel
          id="priority-cases"
          title="Priority recovery cases"
          description="Open cases ranked by a transparent rule. Every figure is an estimate until verified."
          className="xl:col-span-5"
        >
          <PriorityCases cases={o.rankedCases} pipeline={o.pipeline} />
        </Panel>
      </div>

      <Panel
        id="sites"
        title="Site performance"
        description="Last 24 hours, valid intervals only."
      >
        <SitesTable sites={data.sites} now={o.now} />
      </Panel>
    </div>
  );
}
