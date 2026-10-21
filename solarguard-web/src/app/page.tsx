import type { Metadata } from "next";
import { Activity, BatteryCharging, LifeBuoy, MapPinned, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { ActivityFeed } from "@/components/overview/ActivityFeed";
import { LivePriorityCases } from "@/components/overview/LivePriorityCases";
import { PowerChart } from "@/components/overview/PowerChart";
import { PriorityCases } from "@/components/overview/PriorityCases";
import { SitesTable } from "@/components/overview/SitesTable";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StaleDataNotice } from "@/components/ui/StaleDataNotice";
import { getFleetOverview } from "@/lib/api/fleet";
import { STALE_AFTER_HOURS } from "@/lib/api/live-fleet";
import { settle } from "@/lib/api/settle";
import { formatDayTime, formatNumber, formatPct, formatTime, TIME_ZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Fleet Overview" };

const DESCRIPTION = "Which sites need attention, how strong the evidence is, and what to check next.";

async function OverviewView() {
  const res = await settle(getFleetOverview());
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Fleet Overview" description={DESCRIPTION} />
        <Panel title="Fleet">
          <ApiProblem error={res.error} />
        </Panel>
      </>
    );
  }
  const o = res.value;
  const { kpis } = o;
  const gap = kpis.energy24h;
  const staleSites = o.sites.filter((s) => s.status === "stale").length;
  const live = o.source === "api";

  if (o.dataThrough === null) {
    return (
      <>
        <PageHeader
          title="Fleet Overview"
          description={DESCRIPTION}
          meta={
            <>
              <span>
                {kpis.sitesTotal} sites · {TIME_ZONE}
              </span>
              <SourceBadge source={o.source} />
            </>
          }
        />
        <Panel title="No telemetry yet">
          <EmptyState
            title="Nothing to show until data arrives"
            action={
              <Link
                href="/upload"
                className="rounded-ctl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                Upload telemetry
              </Link>
            }
          >
            {kpis.sitesTotal === 0
              ? "No sites are registered. Register a site and upload its telemetry CSV."
              : "Sites exist but none has telemetry. Upload a CSV to see output, gaps and alerts."}
          </EmptyState>
        </Panel>
      </>
    );
  }

  const dataThrough = o.dataThrough;
  const pipeline = o.cases.pipeline;

  return (
    <>
      <PageHeader
        title="Fleet Overview"
        description={DESCRIPTION}
        meta={
          <>
            <span>
              {kpis.sitesTotal} sites · {TIME_ZONE}
            </span>
            <span className="num">
              Data through {formatDayTime(dataThrough)}
              {staleSites > 0 ? ` · ${staleSites} site${staleSites === 1 ? "" : "s"} not reporting` : ""}
            </span>
            <SourceBadge source={o.source} />
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

      {live ? <StaleDataNotice dataThrough={dataThrough} now={o.now} thresholdHours={STALE_AFTER_HOURS} /> : null}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Monitored sites"
          icon={MapPinned}
          value={String(kpis.sitesTotal)}
          context={`${kpis.sitesReporting} of ${kpis.sitesTotal} reporting in the latest hour of data`}
        />
        <MetricCard
          label="Fleet power, latest hour"
          icon={Activity}
          value={kpis.latestFleetKw === null ? "No data" : formatNumber(kpis.latestFleetKw)}
          unit={kpis.latestFleetKw === null ? undefined : "kW"}
          context={
            kpis.expectedFleetKwAtLatest === null
              ? `No site had actual and expected values in the hour to ${formatTime(dataThrough)}`
              : `Expected ${formatNumber(kpis.expectedFleetKwAtLatest)} kW · hour to ${formatTime(dataThrough)}`
          }
        />
        <MetricCard
          label="Energy, latest 24 h of data"
          icon={BatteryCharging}
          value={formatNumber(gap.actualKwh)}
          unit="kWh"
          badge={
            <ImpactStatusLabel
              level="estimated"
              label={`Gap ${formatNumber(gap.gapKwh)} kWh (${gap.gapPct === null ? "n/a" : formatPct(gap.gapPct)})`}
            />
          }
          context={`Expected ${formatNumber(gap.expectedKwh)} kWh · valid intervals only`}
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
          context={`${kpis.casesNeedingReview} need review · ${pipeline.verified} outcome${pipeline.verified === 1 ? "" : "s"} verified`}
          href="#priority-cases"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
          <Panel
            title="Actual vs expected production"
            description={
              live
                ? "Fleet total over the latest 72 hours of data. Expected power is the stored value for each site (provided, or derived from its own history)."
                : "Fleet total. Expected power comes from the demo baseline model."
            }
          >
            <PowerChart subject="Fleet" points={o.series} sitesTotal={o.sitesWithData} expectedLabel={live ? "Expected power, as stored (kW)" : undefined} />
          </Panel>

          <Panel title="Recent activity" description={live ? "Alert detections and case updates, newest first." : undefined}>
            <ActivityFeed items={o.activity} now={o.now} />
          </Panel>
        </div>

        <Panel
          id="priority-cases"
          title="Priority recovery cases"
          description="Open cases ranked by a transparent rule. Every figure is an estimate until verified."
          className="min-w-0 xl:col-span-5"
        >
          {o.cases.kind === "live" ? (
            <LivePriorityCases cases={o.cases.ranked} pipeline={o.cases.pipeline} />
          ) : (
            <PriorityCases cases={o.cases.ranked} pipeline={o.cases.pipeline} />
          )}
        </Panel>
      </div>

      <Panel id="sites" title="Site performance" description="Latest 24 hours of data, valid intervals only.">
        <SitesTable sites={o.sites} now={o.now} />
      </Panel>
    </>
  );
}

export default function FleetOverviewPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <OverviewView />
      </Suspense>
    </div>
  );
}
