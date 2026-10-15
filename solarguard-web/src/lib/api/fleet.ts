/**
 * Fleet service boundary.
 * UI code calls getFleetOverview(); today it is backed by deterministic demo fixtures,
 * later it will call the FastAPI backend. The returned shape is the contract.
 */
import { compareByPriority, summariseEnergy } from "../domain";
import { buildFleetData, INTERVAL_HOURS, type FleetData } from "../fixtures";

export interface FleetOverview {
  source: "demo" | "api";
  now: number;
  data: FleetData;
  kpis: {
    sitesTotal: number;
    sitesReporting: number;
    sitesNeedingAttention: number;
    latestFleetKw: number;
    latestFleetAt: number;
    expectedFleetKwAtLatest: number;
    energy24h: {
      actualKwh: number;
      expectedKwh: number;
      gapKwh: number;
      gapPct: number | null;
    };
    openCases: number;
    casesNeedingReview: number;
  };
  rankedCases: FleetData["cases"];
  pipeline: {
    needsReview: number;
    actionAssigned: number;
    inProgress: number;
    resolved: number;
    verified: number;
    inconclusive: number;
  };
}

export async function getFleetOverview(): Promise<FleetOverview> {
  const data = buildFleetData();
  const latest = data.series[data.series.length - 1];

  const e = summariseEnergy(
    data.series.slice(-24).map((p) => ({
      t: p.t,
      actualKw: p.actualKw,
      expectedKw: p.expectedKw,
    })),
    INTERVAL_HOURS,
  );

  const open = data.cases.filter((c) => c.status !== "resolved");
  const rankedCases = [...open].sort(compareByPriority);

  return {
    source: "demo",
    now: data.now,
    data,
    kpis: {
      sitesTotal: data.sitesTotal,
      sitesReporting: latest.reporting,
      sitesNeedingAttention: data.sites.filter((s) => s.status !== "healthy").length,
      latestFleetKw: latest.actualKw,
      latestFleetAt: latest.t,
      expectedFleetKwAtLatest: latest.expectedKw,
      energy24h: {
        actualKwh: e.actualKwh,
        expectedKwh: e.expectedKwh,
        gapKwh: e.gapKwh,
        gapPct: e.gapPct,
      },
      openCases: open.length,
      casesNeedingReview: open.filter((c) => c.status === "needs_review").length,
    },
    rankedCases,
    pipeline: {
      needsReview: data.cases.filter((c) => c.status === "needs_review").length,
      actionAssigned: data.cases.filter((c) => c.status === "action_assigned").length,
      inProgress: data.cases.filter((c) => c.status === "in_progress").length,
      resolved: data.cases.filter((c) => c.status === "resolved").length,
      verified: data.cases.filter((c) => c.verification === "verified").length,
      inconclusive: data.cases.filter(
        (c) => c.status === "resolved" && c.verification === "inconclusive",
      ).length,
    },
  };
}
