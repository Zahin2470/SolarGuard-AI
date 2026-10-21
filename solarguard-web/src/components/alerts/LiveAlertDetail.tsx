import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PowerChart } from "@/components/overview/PowerChart";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import type { AlertDetail } from "@/lib/api/alerts";
import { NOT_IN_DATA } from "@/lib/api/live-fleet";
import { formatDayTime, formatNumber, formatPct, TIME_ZONE } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL } from "@/lib/labels";

/**
 * Alert detail for live API records. rule_v1 detects a sustained deviation only: it supplies no
 * cause, no confidence and no recommended check, so none is shown here (a person adds a hypothesis
 * on the recovery case).
 */
export function LiveAlertDetail({ d }: { d: Extract<AlertDetail, { source: "api" }> }) {
  const a = d.alert;
  const c = d.linkedCase;
  const wf = Date.parse(a.window_from);
  const wt = Date.parse(a.window_to);
  const windowLabel = `${formatDayTime(wf)} to ${formatDayTime(wt)}`;

  return (
    <div className="space-y-6">
      <Link href="/alerts" className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" />
        All alerts
      </Link>

      <PageHeader
        title={`${d.siteName}: ${a.title}`}
        meta={
          <>
            <StatusChip status={a.severity} />
            <span>
              {a.id} · {a.status === "closed" ? "Deviation ended" : "Still open"}
            </span>
            <span className="num">Detected {formatDayTime(Date.parse(a.detected_at))}</span>
            <span>{a.persistence_hours} h</span>
            <SourceBadge source="api" />
          </>
        }
        action={
          <Link
            href={`/sites/${a.site_id}`}
            className="inline-flex items-center rounded-ctl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
          >
            Open site
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
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
                <dt className="text-xs text-ink-muted">Evidence window ({TIME_ZONE})</dt>
                <dd className="font-semibold text-ink">{windowLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Deviation from expected</dt>
                <dd className="font-semibold text-ink">
                  {a.deviation_pct === null ? "Not computable" : `${formatPct(a.deviation_pct)} below`}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-ink-muted">Estimated gap, window</dt>
                <dd className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                  {a.est_gap_kwh === null ? (
                    "Not estimable"
                  ) : (
                    <>
                      {formatNumber(a.est_gap_kwh)} kWh <ImpactStatusLabel level="estimated" />
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              Detector <code>{a.detector}</code>: a rule on sustained deviation from the expected-power input. No model
              anomaly score is computed.
            </p>
          </Panel>

          <Panel title="Observed vs expected" description="Shaded area marks the evidence window.">
            <PowerChart
              subject={d.siteName}
              points={d.series}
              highlight={{ from: wf, label: "Alert evidence window" }}
              defaultRange="72h"
              showRangeTabs={false}
              expectedLabel={
                d.derivedBaseline
                  ? "Expected power, derived from this site's own history (kW)"
                  : "Expected power, provided with the upload (kW)"
              }
            />
            {d.derivedBaseline ? (
              <p className="mt-3 rounded-lg border border-dashed border-warn-line bg-warn-soft/50 p-3 text-xs text-ink-muted">
                <span className="font-semibold text-warn">Derived baseline.</span> It can absorb a fault that has lasted
                several days, so the deviation shown may understate the real shortfall.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-5">
          <Panel title="Cause and next check" description="Left to a person: the detector does not diagnose.">
            <p className="text-sm text-ink-muted">
              No probable cause, confidence or recommended check is supplied for this alert. Open a recovery case to
              record a hypothesis and a reason for it.
            </p>
            <h3 className="mt-4 text-sm font-semibold text-ink">Not observable from this data</h3>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
              {NOT_IN_DATA.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recovery case">
            {c ? (
              <>
                <p className="text-sm font-semibold text-ink">
                  <Link href={`/recovery-cases/${c.id}`} className="underline-offset-2 hover:text-primary-strong hover:underline">
                    {c.id}: {c.title}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {LIVE_CASE_STATUS_LABEL[c.status]} · Owner: {c.owner ?? "Unassigned"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.recoverable_kwh === null ? (
                    <span className="text-sm text-ink-muted">Recoverable energy not estimated yet.</span>
                  ) : (
                    <>
                      <span className="num text-sm font-semibold text-ink">{formatNumber(c.recoverable_kwh)} kWh</span>
                      <ImpactStatusLabel level="potential" label="Potential" />
                    </>
                  )}
                </div>
                <div className="mt-3">
                  <VerificationLabel status={c.verification_status} />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                No recovery case yet.{" "}
                <Link href="/recovery-cases" className="font-semibold text-primary-strong underline underline-offset-2">
                  Open one from Recovery Cases
                </Link>{" "}
                to start a human review.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
