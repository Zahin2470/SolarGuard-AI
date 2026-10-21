/**
 * Fleet service boundary. With SOLARGUARD_API_URL set it reads the FastAPI backend; if the API
 * is configured but unreachable it throws (the page shows an error, never demo data in its place).
 * Without the variable it serves clearly labelled demo fixtures.
 */
import type { ChartPoint } from "@/components/overview/PowerChart";
import { compareByPriority, summariseEnergy } from "../domain";
import { buildFleetData, INTERVAL_HOURS, type ActivityItem, type RecoveryCaseSummary, type SiteSummary } from "../fixtures";
import type { CasePipeline } from "../view";
import { OPEN_CASE_STATUSES } from "../labels";
import { isLive } from "./client";
import { casePipeline, loadLiveFleet } from "./live-fleet";
import type { ApiCase } from "./types";

export interface FleetOverview {
  source: "demo" | "api";
  /** Reference time for "x ago" labels. */
  now: number;
  /** End of the latest hour with data; null when there is none. */
  dataThrough: number | null;
  sitesTotal: number;
  /** Sites that have any telemetry (the chart flags hours where fewer than this report). */
  sitesWithData: number;
  sites: SiteSummary[];
  series: ChartPoint[];
  activity: ActivityItem[];
  kpis: {
    sitesTotal: number;
    sitesReporting: number;
    sitesNeedingAttention: number;
    latestFleetKw: number | null;
    expectedFleetKwAtLatest: number | null;
    energy24h: { actualKwh: number; expectedKwh: number; gapKwh: number; gapPct: number | null };
    openCases: number;
    casesNeedingReview: number;
  };
  cases:
    | { kind: "demo"; ranked: RecoveryCaseSummary[]; pipeline: CasePipeline }
    | { kind: "live"; ranked: ApiCase[]; pipeline: CasePipeline };
}

export async function getFleetOverview(): Promise<FleetOverview> {
  if (await isLive()) {
    const f = await loadLiveFleet();
    return {
      source: "api",
      now: f.now,
      dataThrough: f.dataThrough,
      sitesTotal: f.kpis.sitesTotal,
      sitesWithData: f.sitesWithData,
      sites: f.sites,
      series: f.series,
      activity: f.activity,
      kpis: f.kpis,
      cases: {
        kind: "live",
        // The API already ranks by severity, then estimated gap.
        ranked: f.cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status)),
        pipeline: casePipeline(f.cases),
      },
    };
  }

  const data = buildFleetData();
  const latest = data.series[data.series.length - 1];
  const e = summariseEnergy(
    data.series.slice(-24).map((p) => ({ actualKw: p.actualKw, expectedKw: p.expectedKw })),
    INTERVAL_HOURS,
  );
  const open = data.cases.filter((c) => c.status !== "resolved");
  return {
    source: "demo",
    now: data.now,
    dataThrough: latest.t + 3_600_000,
    sitesTotal: data.sitesTotal,
    sitesWithData: data.sitesTotal,
    sites: data.sites,
    series: data.series,
    activity: data.activity,
    kpis: {
      sitesTotal: data.sitesTotal,
      sitesReporting: latest.reporting,
      sitesNeedingAttention: data.sites.filter((s) => s.status !== "healthy").length,
      latestFleetKw: latest.actualKw,
      expectedFleetKwAtLatest: latest.expectedKw,
      energy24h: { actualKwh: e.actualKwh, expectedKwh: e.expectedKwh, gapKwh: e.gapKwh, gapPct: e.gapPct },
      openCases: open.length,
      casesNeedingReview: open.filter((c) => c.status === "needs_review").length,
    },
    cases: {
      kind: "demo",
      ranked: [...open].sort(compareByPriority),
      pipeline: {
        needsReview: data.cases.filter((c) => c.status === "needs_review").length,
        actionAssigned: data.cases.filter((c) => c.status === "action_assigned").length,
        inProgress: data.cases.filter((c) => c.status === "in_progress").length,
        resolved: data.cases.filter((c) => c.status === "resolved").length,
        verified: data.cases.filter((c) => c.verification === "verified").length,
        inconclusive: data.cases.filter((c) => c.status === "resolved" && c.verification === "inconclusive").length,
      },
    },
  };
}
