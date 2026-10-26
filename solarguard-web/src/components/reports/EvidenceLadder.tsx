import { ArrowRight } from "lucide-react";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import type { LedgerTotals } from "@/lib/ledger";
import { formatNumber } from "@/lib/format";

function Lane({
  level,
  label,
  value,
  unit,
  detail,
  tone = "default",
}: {
  level: Parameters<typeof ImpactStatusLabel>[0]["level"];
  label?: string;
  value: string;
  unit?: string;
  detail: string;
  tone?: "default" | "strong";
}) {
  return (
    <li
      className={
        tone === "strong"
          ? "rounded-card border border-primary/40 bg-primary-soft/50 p-4"
          : "rounded-card border border-line bg-surface p-4 shadow-card"
      }
    >
      <ImpactStatusLabel level={level} label={label} />
      <p className="num mt-3 text-2xl font-semibold tracking-tight text-ink">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-ink-muted">{unit}</span> : null}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </li>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Five lanes, left to right by strength of evidence. They are shown side by side and never summed:
 * each answers a different question and only the last is a claim about what actually happened.
 */
export function EvidenceLadder({ t }: { t: LedgerTotals }) {
  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Evidence ladder, weakest to strongest">
        <Lane
          level="estimated"
          value={t.estimated.cases ? formatNumber(t.estimated.kwh) : "None"}
          unit={t.estimated.cases ? "kWh" : undefined}
          detail={`Expected minus actual over alert windows, ${plural(t.estimated.cases, "case")}. A model-based gap, not lost revenue.`}
        />
        <Lane
          level="potential"
          value={t.potential.cases ? formatNumber(t.potential.kwh) : "Not estimated"}
          unit={t.potential.cases ? "kWh" : undefined}
          detail={`Share of the gap a person judged recoverable, with a reason: ${plural(t.potential.cases, "case")}. ${t.potential.withoutEstimate} without an estimate.`}
        />
        <Lane
          level="recorded"
          value={String(t.recorded.cases)}
          unit={t.recorded.cases === 1 ? "action" : "actions"}
          detail="Documented as done. This shows it was recorded, not that it worked."
        />
        <Lane
          level="measured"
          value={t.measured.cases ? formatNumber(t.measured.kwh) : "None"}
          unit={t.measured.cases ? "kWh" : undefined}
          detail={`Output changed after the action, but the comparison cannot support "verified": ${plural(t.measured.cases, "case")}. Post-action window only.`}
        />
        <Lane
          level="verified"
          tone="strong"
          value={t.verified.cases ? formatNumber(t.verified.kwh) : "None yet"}
          unit={t.verified.cases ? "kWh" : undefined}
          detail={
            t.verified.cases
              ? `Documented before/after comparison on an independent baseline: ${plural(t.verified.cases, "case")}. Extra energy in the 7-day post-action window, not annualised.`
              : "No outcome has passed the verification check. That is a valid result, not a gap to fill."
          }
        />
      </ol>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <ArrowRight aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Lanes are kept apart on purpose: they are not additive and must not be quoted as one &quot;savings&quot; figure.
        {t.notVerifiable + t.notYetVerified + t.inconclusive > 0
          ? ` Outcomes without a conclusion: ${t.notYetVerified} not yet checked, ${t.notVerifiable} not verifiable, ${t.inconclusive} inconclusive.`
          : ""}
        {t.rejected > 0 ? ` ${plural(t.rejected, "rejected case")} excluded from every lane.` : ""}
      </p>
    </div>
  );
}
