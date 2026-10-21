/**
 * Domain types and pure calculations for SolarGuard AI.
 * No React, no I/O: these functions are unit-testable and shared by API adapters and UI.
 */

export type SiteStatus = "healthy" | "warning" | "critical" | "stale";
export type Severity = "info" | "warning" | "critical";

export type CaseStatus =
  | "needs_review"
  | "confirmed"
  | "action_assigned"
  | "in_progress"
  | "resolved";

/** Outcome verification status. Never "verified" without a defensible comparison. */
export type VerificationStatus =
  | "not_yet_verified"
  | "verified"
  | "inconclusive"
  | "not_verifiable";

/** Evidence levels from the master prompt (section 35.4) plus data-provenance labels. */
export type ImpactLevel =
  | "detected"
  | "estimated"
  | "potential"
  | "recorded"
  | "measured"
  | "verified"
  | "not_verified"
  | "inconclusive"
  | "demo";

/** One interval of fleet or site power. `t` is the interval START (epoch ms, UTC). */
export interface PowerPoint {
  t: number;
  /** Mean actual power over the interval in kW. null = no data (NOT zero). */
  actualKw: number | null;
  /** Modelled expected mean power over the interval in kW. */
  expectedKw: number;
}

export interface EnergySummary {
  /** Energy over valid intervals only (kWh). */
  actualKwh: number;
  expectedKwh: number;
  /** expected - actual over valid intervals (kWh). Positive = shortfall. */
  gapKwh: number;
  gapPct: number | null;
  validIntervals: number;
  skippedIntervals: number;
}

/**
 * Integrate mean-power samples into energy.
 * kWh = sum(kW * intervalHours). Intervals with a missing actual OR expected value are excluded from BOTH
 * actual and expected so the comparison stays like-for-like.
 */
/** Anything with an actual and an expected value; either may be missing (null). */
export interface EnergyPoint {
  actualKw: number | null;
  expectedKw: number | null;
}

export function summariseEnergy(
  points: EnergyPoint[],
  intervalHours: number,
): EnergySummary {
  let actual = 0;
  let expected = 0;
  let valid = 0;
  let skipped = 0;
  for (const p of points) {
    if (p.actualKw === null || p.expectedKw === null) {
      skipped += 1;
      continue;
    }
    actual += p.actualKw * intervalHours;
    expected += p.expectedKw * intervalHours;
    valid += 1;
  }
  const gap = expected - actual;
  return {
    actualKwh: actual,
    expectedKwh: expected,
    gapKwh: gap,
    gapPct: expected > 0 ? (gap / expected) * 100 : null,
    validIntervals: valid,
    skippedIntervals: skipped,
  };
}

export type ConfidenceBand = "Low" | "Medium" | "High";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

const SEVERITY_TIER: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export interface RankableCase {
  severity: Severity;
  confidence: number;
  /** Estimated potentially recoverable energy per day (kWh/day), or null if not estimable. */
  recoverableKwhPerDay: number | null;
}

/**
 * Transparent priority rule (demo rule, to be validated with operators):
 *   1. Higher severity tier first.
 *   2. Within a tier, higher confidence-weighted recoverable energy
 *      (confidence x potentially recoverable kWh/day) first.
 *   3. Cases whose recoverable energy cannot be estimated sort last within their tier.
 * No tuned weights are involved, so every ranking can be explained in one sentence.
 */
export function priorityKey(c: RankableCase): [number, number] {
  return [
    SEVERITY_TIER[c.severity],
    c.recoverableKwhPerDay === null ? -1 : c.confidence * c.recoverableKwhPerDay,
  ];
}

export function compareByPriority(a: RankableCase, b: RankableCase): number {
  const [ta, ea] = priorityKey(a);
  const [tb, eb] = priorityKey(b);
  if (ta !== tb) return tb - ta;
  return eb - ea;
}
