import { describe, expect, it } from "vitest";
import { compareByPriority, summariseEnergy } from "../domain";

describe("summariseEnergy", () => {
  it("excludes intervals with a missing actual or expected from BOTH totals", () => {
    const e = summariseEnergy(
      [
        { actualKw: 80, expectedKw: 100 },
        { actualKw: null, expectedKw: 100 },
        { actualKw: 50, expectedKw: null },
        { actualKw: 90, expectedKw: 100 },
      ],
      1,
    );
    expect(e.actualKwh).toBe(170);
    expect(e.expectedKwh).toBe(200);
    expect(e.gapKwh).toBe(30);
    expect(e.validIntervals).toBe(2);
    expect(e.skippedIntervals).toBe(2);
  });
  it("scales by interval length", () => {
    expect(summariseEnergy([{ actualKw: 100, expectedKw: 100 }], 0.25).actualKwh).toBe(25);
  });
  it("gives a null percentage instead of dividing by zero", () => {
    expect(summariseEnergy([], 1).gapPct).toBeNull();
  });
});

describe("compareByPriority", () => {
  const c = (severity: "critical" | "warning", confidence: number, rec: number | null) => ({
    severity,
    confidence,
    recoverableKwhPerDay: rec,
  });
  it("ranks severity before energy", () => {
    expect(compareByPriority(c("critical", 0.1, 1), c("warning", 0.9, 1000))).toBeLessThan(0);
  });
  it("ranks cases with no recoverable estimate last within a tier", () => {
    expect(compareByPriority(c("warning", 0.9, null), c("warning", 0.1, 5))).toBeGreaterThan(0);
  });
});
