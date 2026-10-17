import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { CaseActions } from "@/components/cases/CaseActions";
import { CaseEstimates } from "@/components/cases/CaseEstimates";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import { VerificationPanel } from "@/components/cases/VerificationPanel";
import { PowerChart, type ChartPoint } from "@/components/overview/PowerChart";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { ApiError } from "@/lib/api/client";
import { getAlert, getCase, getSite, getTelemetry } from "@/lib/api/live";
import { settle } from "@/lib/api/settle";
import type { ApiAlert } from "@/lib/api/types";
import { formatDayTime, formatNumber, formatPct, TIME_ZONE } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Recovery case" };

const HOUR = 3_600_000;

async function EvidenceChart({ alert }: { alert: ApiAlert }) {
  const wf = Date.parse(alert.window_from);
  const wt = Date.parse(alert.window_to);
  const to = wt + 12 * HOUR;
  const from = Math.max(wf - 24 * HOUR, to - 72 * HOUR);
  const res = await settle(getTelemetry(alert.site_id, new Date(from).toISOString(), new Date(to).toISOString()));
  if (!res.ok) return <ApiProblem error={res.error} />;

  const rows = res.value;
  const points: ChartPoint[] = rows.map((r) => ({
    t: Date.parse(r.ts),
    actualKw: r.actual_kw,
    expectedKw: r.expected_kw,
  }));
  const sources = new Set(rows.map((r) => r.expected_source).filter(Boolean));
  const expectedLabel = sources.has("derived")
    ? "Expected power, derived from this site's own history (kW)"
    : "Expected power, provided with the upload (kW)";
  return (
    <>
      <PowerChart
        subject={`Site ${alert.site_id}`}
        points={points}
        defaultRange="72h"
        highlight={{ from: wf, label: "Alert evidence window" }}
        expectedLabel={expectedLabel}
      />
      {sources.has("derived") ? (
        <p className="mt-3 rounded-lg border border-dashed border-warn-line bg-warn-soft/50 p-3 text-xs text-ink-muted">
          <span className="font-semibold text-warn">Derived baseline.</span> The expected line is a trailing median of
          this site&apos;s own recent days, so it can absorb a fault that has lasted several days. It is useful for
          spotting change, but this case can never reach <em>Verified</em> on it.
        </p>
      ) : null}
    </>
  );
}

async function CaseDetail({ params }: { params: PageProps<"/recovery-cases/[id]">["params"] }) {
  const { id } = await params;

  const caseRes = await settle(getCase(id));
  if (!caseRes.ok) {
    if (caseRes.error instanceof ApiError && caseRes.error.status === 404) notFound();
    return <ApiProblem error={caseRes.error} />;
  }
  const c = caseRes.value;

  const [alertRes, siteRes] = await Promise.allSettled([getAlert(c.alert_id), getSite(c.site_id)]);
  const alert = alertRes.status === "fulfilled" ? alertRes.value : null;
  const site = siteRes.status === "fulfilled" ? siteRes.value : null;
  const terminal = c.status === "resolved" || c.status === "rejected";

  return (
    <div className="space-y-6">
      <Link
        href="/recovery-cases"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All recovery cases
      </Link>

      <PageHeader
        title={c.title}
        meta={
          <>
            <StatusChip status={c.severity} />
            <span>
              {c.id} · {LIVE_CASE_STATUS_LABEL[c.status]}
            </span>
            <span>
              {site ? `${site.name} (${site.id})` : `Site ${c.site_id}`}
              {site ? ` · ${formatNumber(site.capacity_kwp)} kWp` : ""}
            </span>
            <span>Alert {c.alert_id}</span>
          </>
        }
      />

      <section aria-label="Case figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Estimated gap, alert window" label2={c.est_gap_kwh === null ? "Not estimable" : `${formatNumber(c.est_gap_kwh)} kWh`}>
          {c.est_gap_kwh !== null ? <ImpactStatusLabel level="estimated" /> : null}
        </Fact>
        <Fact
          label="Potentially recoverable"
          label2={c.recoverable_kwh === null ? "Not estimated yet" : `${formatNumber(c.recoverable_kwh)} kWh`}
        >
          {c.recoverable_kwh !== null ? <ImpactStatusLabel level="potential" label="Potential" /> : null}
        </Fact>
        <Fact label="Owner" label2={c.owner ?? "Unassigned"} />
        <Fact label="Action" label2={c.action_taken ? "Recorded" : "None recorded"}>
          {c.action_taken ? <ImpactStatusLabel level="recorded" /> : null}
        </Fact>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
          <Panel
            title="Evidence"
            description="What the data shows. A detected deviation is a signal, not a confirmed fault."
          >
            {alert ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ImpactStatusLabel level="detected" />
                  <span className="num text-xs text-ink-muted">
                    {formatDayTime(Date.parse(alert.window_from))} to {formatDayTime(Date.parse(alert.window_to))} (
                    {TIME_ZONE}) · {alert.persistence_hours} h
                    {alert.deviation_pct !== null ? ` · ${formatPct(alert.deviation_pct)} below expected on average` : ""}
                  </span>
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                  {alert.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                {alert.kind === "underperformance" ? (
                  <Suspense fallback={<Skeleton className="h-[330px] w-full rounded-lg" />}>
                    <EvidenceChart alert={alert} />
                  </Suspense>
                ) : (
                  <p className="text-sm text-ink-muted">
                    This alert is about missing data, so there is no output series to plot. Missing data is shown as a
                    gap, never as zero output.
                  </p>
                )}
              </div>
            ) : (
              <ApiProblem error={alertRes.status === "rejected" ? alertRes.reason : new Error("alert unavailable")} />
            )}
          </Panel>

          <Panel title="Timeline" description="Append-only audit trail of everything done on this case.">
            <CaseTimeline events={c.events ?? []} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-5">
          <Panel
            title={terminal ? "Status" : "Next step"}
            description={
              terminal
                ? "This case has reached an end state."
                : "Only the actions valid for the current status are shown."
            }
          >
            {c.status === "rejected" && c.rejection_reason ? (
              <p className="mb-3 rounded-lg border border-line bg-canvas/60 p-3 text-sm text-ink">
                <span className="font-semibold">Rejected because: </span>
                {c.rejection_reason}
              </p>
            ) : null}
            {c.action_taken ? (
              <div className="mb-4 rounded-lg border border-line bg-canvas/60 p-3 text-sm text-ink">
                <p className="mb-1 flex items-center gap-2 font-semibold">
                  Action taken <ImpactStatusLabel level="recorded" />
                </p>
                <p className="whitespace-pre-wrap text-ink-muted">{c.action_taken}</p>
                {c.action_started_at || c.action_completed_at ? (
                  <p className="num mt-1.5 text-xs text-ink-muted">
                    {c.action_started_at ? `Started ${formatDayTime(Date.parse(c.action_started_at))}` : ""}
                    {c.action_started_at && c.action_completed_at ? " · " : ""}
                    {c.action_completed_at ? `Completed ${formatDayTime(Date.parse(c.action_completed_at))}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <CaseActions
              caseId={c.id}
              status={c.status}
              verificationRun={c.verification_status !== "not_yet_verified"}
            />
          </Panel>

          <Panel
            title="Cause and recoverable estimate"
            description="Human judgement, recorded with a reason. Left empty until you provide both."
          >
            {terminal ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Probable cause (hypothesis)</dt>
                  <dd className="text-ink">{c.probable_cause ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Recoverable share</dt>
                  <dd className="text-ink">
                    {c.recoverable_fraction === null
                      ? "Not estimated"
                      : `${formatNumber(c.recoverable_fraction * 100)}%. ${c.recoverable_rationale ?? ""}`}
                  </dd>
                </div>
              </dl>
            ) : (
              <CaseEstimates c={c} />
            )}
          </Panel>

          <Panel
            title="Outcome"
            description="Whether the recorded action measurably changed output."
          >
            <VerificationPanel c={c} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Fact({
  label,
  label2,
  children,
}: {
  label: string;
  label2: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="num mt-1 text-xl font-semibold tracking-tight text-ink">{label2}</p>
      {children ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}

export default function RecoveryCasePage({ params }: PageProps<"/recovery-cases/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy="true" aria-label="Loading case">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CaseDetail params={params} />
    </Suspense>
  );
}
