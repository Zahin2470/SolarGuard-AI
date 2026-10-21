import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PowerChart } from "@/components/overview/PowerChart";
import { ConfidenceIndicator } from "@/components/ui/ConfidenceIndicator";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import type { AlertDetail } from "@/lib/api/alerts";
import { CASE_STATUS_LABEL } from "@/lib/labels";
import { formatDayTime, formatNumber, formatPct } from "@/lib/format";

/** Alert detail for the demo fixtures, which carry illustrative cause and confidence fields. */
export function DemoAlertDetail({ d }: { d: Extract<AlertDetail, { source: "demo" }> }) {
  const { alert: a, linkedCase: c } = d;

  return (
    <div className="space-y-6">
      <Link
        href="/alerts"
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All alerts
      </Link>

      <PageHeader
        title={`${a.siteName}: ${a.title}`}
        meta={
          <>
            <StatusChip status={a.severity} />
            <span>{a.id}</span>
            <span className="num">Detected {formatDayTime(a.detectedAt)}</span>
            <span>{a.persistence}</span>
            <SourceBadge source="demo" />
          </>
        }
        action={
          <Link
            href={`/sites/${a.siteId}`}
            className="inline-flex items-center rounded-ctl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
          >
            Open site
          </Link>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <Panel
            title="Observed evidence"
            description="What the data shows. No diagnosis is assumed here."
            action={<ImpactStatusLabel level="detected" />}
          >
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink marker:text-line-strong">
              {a.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <dl className="num mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-muted">Evidence window</dt>
                <dd className="font-semibold text-ink">{a.windowLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Deviation from expected</dt>
                <dd className="font-semibold text-ink">
                  {a.deviationPct === null ? "Not computable" : `${formatPct(a.deviationPct)} below`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Anomaly score</dt>
                <dd className="font-semibold text-ink">Not computed</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              This demo build uses a rule-based detector on an expected-power baseline. A model
              anomaly score appears once a trained model is connected.
            </p>
          </Panel>

          <Panel title="Observed vs expected" description="Shaded area marks the evidence window.">
            {a.outsideHistory ? (
              <EmptyState title="No chart for this alert">
                Its evidence window is older than the 72 h of demo history, so there is no telemetry to plot.
              </EmptyState>
            ) : (
              <PowerChart
                subject={a.siteName}
                points={d.series}
                highlight={{ from: a.windowFrom, label: a.windowLabel }}
                defaultRange="72h"
                showRangeTabs={false}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <Panel
            title="Probable cause"
            description="A hypothesis to check, not a confirmed diagnosis."
          >
            <p className="text-sm font-semibold text-ink">{a.probableCause}</p>
            <div className="mt-3">
              <p className="mb-1 text-xs text-ink-muted">Model confidence (demo value, not calibrated)</p>
              <ConfidenceIndicator value={a.confidence} />
            </div>

            {a.alternativeCauses.length > 0 ? (
              <>
                <h3 className="mt-5 text-sm font-semibold text-ink">Other explanations to rule out</h3>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                  {a.alternativeCauses.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <h3 className="mt-5 text-sm font-semibold text-ink">What would disconfirm this</h3>
            <p className="mt-1 text-sm text-ink-muted">{a.whatWouldDisconfirm}</p>

            <h3 className="mt-5 text-sm font-semibold text-ink">Not observable from this data</h3>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
              {a.notObservable.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recommended check" description="For a qualified person to carry out.">
            <p className="text-sm font-semibold text-ink">{a.recommendedCheck}</p>
          </Panel>

          {c ? (
            <Panel title="Linked recovery case">
              <p className="text-sm font-semibold text-ink">
                {c.id}: {c.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {CASE_STATUS_LABEL[c.status]} · Owner: {c.owner ?? "Unassigned"}
              </p>
              <dl className="num mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="mb-1 text-xs text-ink-muted">Estimated gap, 24 h</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {c.estimatedGapKwh24h === null ? (
                      <span className="font-semibold text-ink">Not estimable</span>
                    ) : (
                      <>
                        <span className="font-semibold text-ink">
                          {formatNumber(c.estimatedGapKwh24h)} kWh
                        </span>
                        <ImpactStatusLabel level="estimated" />
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-ink-muted">Potentially recoverable</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    {c.recoverableKwhPerDay === null ? (
                      <span className="font-semibold text-ink">Insufficient data</span>
                    ) : (
                      <>
                        <span className="font-semibold text-ink">
                          {formatNumber(c.recoverableKwhPerDay)} kWh/day
                        </span>
                        <ImpactStatusLabel level="potential" label="Potential" />
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-muted">{c.recoverableRationale}</p>
              <div className="mt-3">
                <VerificationLabel status={c.verification} />
              </div>
              <p className="mt-4 rounded-lg border border-dashed border-line-strong bg-canvas/60 p-3 text-xs text-ink-muted">
                Assigning an owner, recording the action and closing the case need the backend and
                arrive in a later phase. Nothing on this page changes data.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
