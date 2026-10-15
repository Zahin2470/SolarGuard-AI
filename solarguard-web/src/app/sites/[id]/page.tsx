import type { Metadata } from "next";
import { Activity, BatteryCharging, Database, Gauge, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PowerChart } from "@/components/overview/PowerChart";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import { getSiteDetail, listSiteIds } from "@/lib/api/sites";
import { CASE_STATUS_LABEL } from "@/lib/labels";
import { formatDayTime, formatNumber, formatPct, TIME_ZONE } from "@/lib/format";

export async function generateStaticParams() {
  return (await listSiteIds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/sites/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await getSiteDetail(id);
  return { title: d ? d.site.name : "Site not found" };
}

export default async function SiteDetailPage({ params }: PageProps<"/sites/[id]">) {
  const { id } = await params;
  const d = await getSiteDetail(id);
  if (!d) notFound();

  const { site, quality, energy72h } = d;
  const stale = site.status === "stale";

  return (
    <div className="space-y-6">
      <Link
        href="/sites"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All sites
      </Link>

      <PageHeader
        title={site.name}
        description={site.statusReason}
        meta={
          <>
            <StatusChip status={site.status} />
            <span>
              {site.id} · {site.location} · {formatNumber(site.capacityKwp)} kWp
            </span>
            <span className="num">
              {quality.lastReportedEnd === null
                ? "No data received"
                : `Data through ${formatDayTime(quality.lastReportedEnd)} (${TIME_ZONE})`}
            </span>
            <ImpactStatusLabel level="demo" />
          </>
        }
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Latest power"
          icon={Activity}
          value={stale || site.latestKw === null ? "No data" : formatNumber(site.latestKw, 1)}
          unit={stale || site.latestKw === null ? undefined : "kW"}
          context={stale ? "Site is not reporting" : "Mean over the latest complete hour"}
        />
        <MetricCard
          label="Energy, last 24 h"
          icon={BatteryCharging}
          value={formatNumber(site.actualKwh24h)}
          unit="kWh"
          badge={
            <ImpactStatusLabel
              level="estimated"
              label={`Gap ${formatNumber(site.gapKwh24h)} kWh`}
            />
          }
          context={`Expected ${formatNumber(site.expectedKwh24h)} kWh`}
        />
        <MetricCard
          label="24 h actual ÷ expected"
          icon={Gauge}
          tone={
            site.performanceRatioPct !== null && site.performanceRatioPct < 95
              ? "attention"
              : "default"
          }
          value={site.performanceRatioPct === null ? "n/a" : formatPct(site.performanceRatioPct)}
          context="Valid intervals only. A signal, not a fault."
        />
        <MetricCard
          label="Data completeness, 72 h"
          icon={Database}
          tone={quality.missingIntervals > 0 ? "attention" : "default"}
          value={formatPct(quality.completenessPct, 0)}
          context={`${quality.receivedIntervals} of ${quality.expectedIntervals} hourly intervals received`}
        />
      </section>

      <Panel
        title="Actual vs expected production"
        description="Expected power comes from the demo baseline model."
      >
        <PowerChart subject={site.name} points={d.series} />
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <Panel title="Alerts" description="Detected deviations for this site.">
            {d.alerts.length === 0 ? (
              <EmptyState title="No alerts for this site">
                Alerts appear when output departs from expected for long enough to matter.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {d.alerts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={a.severity} />
                        <span className="text-xs text-ink-muted">
                          {a.id} · {a.status === "closed" ? "Closed" : "Open"}
                        </span>
                      </div>
                      <Link
                        href={`/alerts/${a.id}`}
                        className="mt-1 block text-sm font-semibold text-ink underline-offset-2 hover:text-primary-strong hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="num text-xs text-ink-muted">
                        Detected {formatDayTime(a.detectedAt)} · {a.persistence}
                      </p>
                    </div>
                    <ImpactStatusLabel level="detected" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recovery case history"
            description="Actions taken and where each outcome stands."
          >
            {d.cases.length === 0 ? (
              <EmptyState title="No recovery cases for this site">
                A case is opened when an alert is judged worth a technician&apos;s time.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {d.cases.map((c) => (
                  <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-ink">
                      {c.id}: {c.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {CASE_STATUS_LABEL[c.status]} · Owner: {c.owner ?? "Unassigned"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <VerificationLabel status={c.verification} />
                    </div>
                    {c.verificationNote ? (
                      <p className="mt-1.5 text-xs text-ink-muted">{c.verificationNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title="Data quality"
          description="What this site's diagnosis is built on, and what it is missing."
          className="xl:col-span-5"
        >
          <dl className="num grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Completeness (72 h)</dt>
              <dd className="font-semibold text-ink">{formatPct(quality.completenessPct, 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Missing intervals</dt>
              <dd className="font-semibold text-ink">{quality.missingIntervals}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">72 h actual / expected</dt>
              <dd className="font-semibold text-ink">
                {formatNumber(energy72h.actualKwh)} / {formatNumber(energy72h.expectedKwh)} kWh
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Excluded from totals</dt>
              <dd className="font-semibold text-ink">{energy72h.skippedIntervals} intervals</dd>
            </div>
          </dl>

          <h3 className="mt-5 text-sm font-semibold text-ink">In this data</h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
            {quality.present.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-ink">Not in this data</h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
            {quality.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-dashed border-line-strong bg-canvas/60 p-3 text-xs text-ink-muted">
            Without these fields, a fault cause can only be proposed as a hypothesis. Adding them is
            what would let the platform separate, for example, soiling from a derate.
          </p>
        </Panel>
      </div>
    </div>
  );
}
