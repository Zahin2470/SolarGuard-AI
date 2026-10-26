import Link from "next/link";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import { formatDayTime, formatNumber } from "@/lib/format";
import { LIVE_CASE_STATUS_LABEL } from "@/lib/labels";
import type { LedgerRow } from "@/lib/ledger";

function Outcome({ r }: { r: LedgerRow }) {
  switch (r.outcome) {
    case "verified":
      return <VerificationLabel status="verified" />;
    case "measured":
      return <ImpactStatusLabel level="measured" label="Measured, not verified" />;
    case "inconclusive":
      return <VerificationLabel status="inconclusive" />;
    case "not_verifiable":
      return <VerificationLabel status="not_verifiable" />;
    case "not_verified":
      return <VerificationLabel status="not_yet_verified" />;
    default:
      return <span className="text-ink-subtle">{r.status === "rejected" ? "Rejected" : "Open"}</span>;
  }
}

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState title="No recovery cases yet">
        The ledger fills as cases are opened from alerts, acted on and checked.
      </EmptyState>
    );
  }
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line">
      <table className="num w-full min-w-[60rem] text-left text-xs">
        <caption className="sr-only">Recovery case ledger with evidence level per figure</caption>
        <thead className="bg-sunken text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Case</th>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Estimated gap (kWh)</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Potential (kWh)</th>
            <th scope="col" className="px-3 py-2 font-semibold">Action recorded</th>
            <th scope="col" className="px-3 py-2 font-semibold">Outcome</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">PR change (pts)</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Post-window energy (kWh)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.caseId} className="border-t border-line align-top">
              <th scope="row" className="px-3 py-2.5 text-left font-normal">
                <Link href={`/recovery-cases/${r.caseId}`} className="font-semibold text-ink underline-offset-2 hover:text-primary-strong hover:underline">
                  {r.caseId}
                </Link>
                <span className="mt-0.5 block text-ink-muted">
                  {r.siteId} · {r.title}
                </span>
                <span className="mt-1 block">
                  <StatusChip status={r.severity} />
                </span>
              </th>
              <td className="px-3 py-2.5 text-ink">{LIVE_CASE_STATUS_LABEL[r.status]}</td>
              <td className="px-3 py-2.5 text-right">
                {r.estGapKwh === null ? "n/a" : formatNumber(r.estGapKwh)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {r.recoverableKwh === null ? <span className="text-ink-subtle">not estimated</span> : formatNumber(r.recoverableKwh)}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {r.actionRecorded ? (r.actionCompletedAt ? formatDayTime(Date.parse(r.actionCompletedAt)) : "Yes") : "No"}
              </td>
              <td className="px-3 py-2.5">
                <Outcome r={r} />
                <span className="mt-1 block max-w-[16rem] whitespace-normal text-ink-muted">{r.note}</span>
              </td>
              <td className="px-3 py-2.5 text-right">
                {r.deltaPrPts === null ? "n/a" : `${r.deltaPrPts > 0 ? "+" : ""}${r.deltaPrPts.toFixed(1)}`}
              </td>
              <td className="px-3 py-2.5 text-right">
                {r.postWindowKwh === null ? (
                  "n/a"
                ) : (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5 whitespace-nowrap">
                    {formatNumber(r.postWindowKwh)}
                    <ImpactStatusLabel level={r.outcome === "verified" ? "verified" : "measured"} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
