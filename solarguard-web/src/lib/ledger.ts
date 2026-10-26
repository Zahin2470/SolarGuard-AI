/**
 * Impact ledger: turns recovery cases into figures that stay in separate lanes.
 * Pure functions, no I/O. The five lanes are never added together:
 *   estimated   gap between expected and actual output over the alert window
 *   potential   the part of that gap a person judged recoverable, with a written reason
 *   recorded    an action someone documented (it says nothing about whether it worked)
 *   measured    output changed after the action, but the comparison cannot support "verified"
 *   verified    a documented before/after comparison on an independent baseline supports it
 * Energy only (kWh). No tariff or carbon figures: no sourced inputs exist.
 */
import type { ApiCase } from "./api/types";
import type { ImpactLevel } from "./domain";

export type OutcomeKind = "verified" | "measured" | "inconclusive" | "not_verifiable" | "not_verified" | "not_applicable";

export interface LedgerRow {
  caseId: string;
  siteId: string;
  title: string;
  severity: ApiCase["severity"];
  status: ApiCase["status"];
  estGapKwh: number | null;
  recoverableKwh: number | null;
  actionRecorded: boolean;
  actionCompletedAt: string | null;
  outcome: OutcomeKind;
  /** Highest evidence level this case reaches. */
  level: ImpactLevel;
  deltaPrPts: number | null;
  /** Extra energy in the post-action window. Observed over that window only; never extrapolated. */
  postWindowKwh: number | null;
  baselineIndependent: boolean | null;
  note: string;
}

export interface Lane {
  kwh: number;
  cases: number;
}

export interface LedgerTotals {
  casesTotal: number;
  rejected: number;
  estimated: Lane;
  potential: Lane & { withoutEstimate: number };
  recorded: { cases: number };
  /** Measured change that did NOT reach "verified". */
  measured: Lane;
  verified: Lane;
  notVerifiable: number;
  notYetVerified: number;
  inconclusive: number;
}

function outcomeOf(c: ApiCase): OutcomeKind {
  if (c.status !== "resolved") return "not_applicable";
  switch (c.verification_status) {
    case "verified":
      return "verified";
    case "not_verifiable":
      return "not_verifiable";
    case "inconclusive":
      return c.verification_detail?.delta_performance_ratio_pts !== undefined ? "measured" : "inconclusive";
    default:
      return "not_verified";
  }
}

const LEVEL: Record<OutcomeKind, (c: ApiCase) => ImpactLevel> = {
  verified: () => "verified",
  measured: () => "measured",
  inconclusive: () => "inconclusive",
  not_verifiable: () => "inconclusive",
  not_verified: (c) => (c.action_taken ? "recorded" : "not_verified"),
  not_applicable: (c) =>
    c.recoverable_kwh !== null ? "potential" : c.est_gap_kwh !== null ? "estimated" : "detected",
};

function noteFor(c: ApiCase, outcome: OutcomeKind): string {
  if (c.status === "rejected") return "Rejected: not counted in any lane.";
  const d = c.verification_detail;
  switch (outcome) {
    case "verified":
      return "Verified against an independent baseline. Association, not proof of cause.";
    case "measured":
      return d?.baseline_independent === false
        ? "Measured change only: baseline derived from the site's own history, cannot be verified."
        : "Measured change below the improvement threshold: not verified.";
    case "not_verifiable":
      return "Not verifiable: too few valid production hours before or after the action.";
    case "not_verified":
      return "Action recorded; no before/after check has been run.";
    case "inconclusive":
      return "Comparison did not support a conclusion.";
    default:
      return "Open: estimates only.";
  }
}

export function buildLedger(cases: ApiCase[]): { rows: LedgerRow[]; totals: LedgerTotals } {
  const rows: LedgerRow[] = cases.map((c) => {
    const outcome = c.status === "rejected" ? "not_applicable" : outcomeOf(c);
    const d = c.verification_detail;
    const hasComparison = outcome === "verified" || outcome === "measured";
    return {
      caseId: c.id,
      siteId: c.site_id,
      title: c.title,
      severity: c.severity,
      status: c.status,
      estGapKwh: c.est_gap_kwh,
      recoverableKwh: c.recoverable_kwh,
      actionRecorded: Boolean(c.action_taken),
      actionCompletedAt: c.action_completed_at,
      outcome,
      level: c.status === "rejected" ? "detected" : LEVEL[outcome](c),
      deltaPrPts: hasComparison ? (d?.delta_performance_ratio_pts ?? null) : null,
      postWindowKwh: hasComparison ? (d?.measured_incremental_kwh_post_window ?? null) : null,
      baselineIndependent: hasComparison ? (d?.baseline_independent ?? null) : null,
      note: noteFor(c, outcome),
    };
  });

  const counted = rows.filter((r) => r.status !== "rejected");
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
  const withValue = (xs: (number | null)[]) => xs.filter((x) => x !== null).length;

  const verifiedRows = counted.filter((r) => r.outcome === "verified");
  const measuredRows = counted.filter((r) => r.outcome === "measured");

  return {
    rows,
    totals: {
      casesTotal: rows.length,
      rejected: rows.length - counted.length,
      estimated: {
        kwh: sum(counted.map((r) => r.estGapKwh)),
        cases: withValue(counted.map((r) => r.estGapKwh)),
      },
      potential: {
        kwh: sum(counted.map((r) => r.recoverableKwh)),
        cases: withValue(counted.map((r) => r.recoverableKwh)),
        withoutEstimate: counted.length - withValue(counted.map((r) => r.recoverableKwh)),
      },
      recorded: { cases: counted.filter((r) => r.actionRecorded).length },
      measured: { kwh: sum(measuredRows.map((r) => r.postWindowKwh)), cases: measuredRows.length },
      verified: { kwh: sum(verifiedRows.map((r) => r.postWindowKwh)), cases: verifiedRows.length },
      notVerifiable: counted.filter((r) => r.outcome === "not_verifiable").length,
      notYetVerified: counted.filter((r) => r.outcome === "not_verified").length,
      inconclusive: counted.filter((r) => r.outcome === "inconclusive").length,
    },
  };
}
