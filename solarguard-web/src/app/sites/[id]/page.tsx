import type { Metadata } from "next";
import { Suspense } from "react";
import { Activity, BatteryCharging, Database, Gauge, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { PowerChart } from "@/components/overview/PowerChart";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import { settle } from "@/lib/api/settle";
import { getSiteDetail } from "@/lib/api/sites";
import { formatDayTime, formatNumber, formatPct, TIME_ZONE } from "@/lib/format";

export const metadata: Metadata = { title: "Site" };

async function SiteDetailView({ params }: { params: PageProps<"/sites/[id]">["params"] }) {
  const { id } = await params;
  const res = await settle(getSiteDetail(id));
  if (!res.ok) return <ApiProblem error={res.error} />;
  const d = res.value;
  if (!d) notFound();

  const { site, quality, energy72h } = d;
  const stale = site.status === "stale";
  const noData = quality.windowHours === 0;

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
            <SourceBadge source={d.source} />
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
          label="Energy, latest 24 h of data"
          icon={BatteryCharging}
          value={noData ? "No data" : formatNumber(site.actualKwh24h)}
          unit={noData ? undefined : "kWh"}
          badge={
            noData ? undefined : (
              <ImpactStatusLabel
                level="estimated"
                label={`Gap ${formatNumber(site.gapKwh24h)} kWh`}
              />
            )
          }
          context={noData ? "No telemetry uploaded" : `Expected ${formatNumber(site.expectedKwh24h)} kWh`}
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
          value={noData ? "No data" : formatPct(quality.completenessPct, 0)}
          context={
            noData
              ? "No telemetry uploaded"
              : `${quality.receivedIntervals} of ${quality.expectedIntervals} hourly intervals received`
          }
        />
      </section>

      <Panel
        title="Actual vs expected production"
        description={
          d.source === "demo"
            ? "Expected power comes from the demo baseline model."
            : "Expected power is the value stored with the upload: provided, or derived from the site's own history."
        }
      >
        <PowerChart subject={site.name} points={d.series} />
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
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
                      {c.href ? (
                        <Link href={c.href} className="underline-offset-2 hover:text-primary-strong hover:underline">
                          {c.id}: {c.title}
                        </Link>
                      ) : (
                        `${c.id}: ${c.title}`
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {c.statusLabel} · Owner: {c.owner ?? "Unassigned"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <VerificationLabel status={c.verification} />
                    </div>
                    {c.note ? (
                      <p className="mt-1.5 text-xs text-ink-muted">{c.note}</p>
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

export default function SiteDetailPage({ params }: PageProps<"/sites/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy="true" aria-label="Loading site">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <SiteDetailView params={params} />
    </Suspense>
  );
}
