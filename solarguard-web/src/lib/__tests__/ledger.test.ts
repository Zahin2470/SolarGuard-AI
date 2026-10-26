import { describe, expect, it } from "vitest";
import type { ApiCase } from "../api/types";
import { buildLedger } from "../ledger";

function mk(over: Partial<ApiCase>): ApiCase {
  return {
    id: "RC-0001",
    alert_id: "AL-0001",
    site_id: "S1",
    title: "t",
    severity: "warning",
    status: "needs_review",
    probable_cause: null,
    est_gap_kwh: 100,
    recoverable_fraction: null,
    recoverable_kwh: null,
    recoverable_rationale: null,
    owner: null,
    rejection_reason: null,
    action_taken: null,
    action_started_at: null,
    action_completed_at: null,
    verification_status: "not_yet_verified",
    verification_level: null,
    verification_detail: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    rank_reason: null,
    labels: {},
    events: null,
    ...over,
  };
}

const detail = (over: object) =>
  ({
    method: "performance_ratio_pre_post",
    summary: "s",
    pre_window: {} as never,
    post_window: {} as never,
    limitations: [],
    computed_at: "2026-10-01T00:00:00Z",
    ...over,
  }) as ApiCase["verification_detail"];

describe("buildLedger", () => {
  it("keeps estimated, potential, measured and verified in separate lanes", () => {
    const { totals } = buildLedger([
      mk({ id: "RC-0001", est_gap_kwh: 500, recoverable_kwh: 300 }),
      mk({
        id: "RC-0002",
        est_gap_kwh: 200,
        status: "resolved",
        action_taken: "cleaned",
        verification_status: "verified",
        verification_detail: detail({ delta_performance_ratio_pts: 18.5, measured_incremental_kwh_post_window: 3000, baseline_independent: true }),
      }),
      mk({
        id: "RC-0003",
        est_gap_kwh: 100,
        status: "resolved",
        action_taken: "cleaned",
        verification_status: "inconclusive",
        verification_detail: detail({ delta_performance_ratio_pts: 20, measured_incremental_kwh_post_window: 900, baseline_independent: false }),
      }),
    ]);
    expect(totals.estimated).toEqual({ kwh: 800, cases: 3 });
    expect(totals.potential).toMatchObject({ kwh: 300, cases: 1, withoutEstimate: 2 });
    expect(totals.verified).toEqual({ kwh: 3000, cases: 1 });
    // A derived-baseline improvement is measured, and must never be added to verified.
    expect(totals.measured).toEqual({ kwh: 900, cases: 1 });
    expect(totals.recorded.cases).toBe(2);
  });

  it("never reports verified energy for a case that is not verified", () => {
    const { rows, totals } = buildLedger([
      mk({ status: "resolved", action_taken: "x", verification_status: "not_verifiable", verification_detail: detail({}) }),
    ]);
    expect(rows[0].outcome).toBe("not_verifiable");
    expect(rows[0].postWindowKwh).toBeNull();
    expect(totals.verified.kwh).toBe(0);
    expect(totals.notVerifiable).toBe(1);
  });

  it("excludes rejected cases from every lane and counts them separately", () => {
    const { totals, rows } = buildLedger([mk({ status: "rejected", est_gap_kwh: 999, recoverable_kwh: 999, action_taken: "x" })]);
    expect(totals.estimated.kwh).toBe(0);
    expect(totals.potential.kwh).toBe(0);
    expect(totals.recorded.cases).toBe(0);
    expect(totals.rejected).toBe(1);
    expect(rows[0].level).toBe("detected");
  });

  it("marks a resolved case with no check as recorded, not verified", () => {
    const { rows, totals } = buildLedger([mk({ status: "resolved", action_taken: "x" })]);
    expect(rows[0].level).toBe("recorded");
    expect(totals.notYetVerified).toBe(1);
  });

  it("keeps a negative measured change negative", () => {
    const { totals } = buildLedger([
      mk({
        status: "resolved",
        action_taken: "x",
        verification_status: "inconclusive",
        verification_detail: detail({ delta_performance_ratio_pts: -2, measured_incremental_kwh_post_window: -150, baseline_independent: true }),
      }),
    ]);
    expect(totals.measured.kwh).toBe(-150);
  });
});
