/** Site service boundary: list + detail. Live when SOLARGUARD_API_URL is set, else demo fixtures. */
import type { ChartPoint } from "@/components/overview/PowerChart";
import { summariseEnergy } from "../domain";
import { buildFleetData, INTERVAL_HOURS, type SiteSummary } from "../fixtures";
import { CASE_STATUS_LABEL } from "../labels";
import type { AlertRow, SiteCaseRow } from "../view";
import { isLive } from "./client";
import { loadLiveFleet, loadLiveSiteDetail, NOT_IN_DATA, WINDOW_HOURS } from "./live-fleet";

export interface SiteList {
  source: "demo" | "api";
  now: number;
  sites: SiteSummary[];
}

export interface DataQuality {
  windowHours: number;
  expectedIntervals: number;
  receivedIntervals: number;
  missingIntervals: number;
  completenessPct: number;
  lastReportedEnd: number | null;
  /** Fields present in the data and fields the platform would like but does not have. */
  present: string[];
  missing: string[];
}

export interface SiteDetail {
  source: "demo" | "api";
  now: number;
  site: SiteSummary;
  series: ChartPoint[];
  energy72h: ReturnType<typeof summariseEnergy>;
  quality: DataQuality;
  alerts: AlertRow[];
  cases: SiteCaseRow[];
}

export async function getSites(): Promise<SiteList> {
  if (await isLive()) {
    const f = await loadLiveFleet();
    return { source: "api", now: f.now, sites: f.sites };
  }
  const d = buildFleetData();
  return { source: "demo", now: d.now, sites: d.sites };
}

function qualityFrom(series: ChartPoint[], present: string[]): DataQuality {
  const received = series.filter((p) => p.actualKw !== null).length;
  const lastReported = [...series].reverse().find((p) => p.actualKw !== null);
  return {
    windowHours: series.length,
    expectedIntervals: series.length,
    receivedIntervals: received,
    missingIntervals: series.length - received,
    completenessPct: series.length ? (received / series.length) * 100 : 0,
    lastReportedEnd: lastReported ? lastReported.t + 3_600_000 : null,
    present,
    missing: NOT_IN_DATA,
  };
}

export async function getSiteDetail(id: string): Promise<SiteDetail | null> {
  if (await isLive()) {
    const d = await loadLiveSiteDetail(id);
    if (!d) return null;
    return {
      source: "api",
      now: d.now,
      site: d.site,
      series: d.series,
      energy72h: summariseEnergy(d.series, 1),
      quality: qualityFrom(d.series, d.present),
      alerts: d.alerts,
      cases: d.cases,
    };
  }

  const d = buildFleetData();
  const site = d.sites.find((s) => s.id === id);
  if (!site) return null;
  const series = d.siteSeries[id];
  return {
    source: "demo",
    now: d.now,
    site,
    series,
    energy72h: summariseEnergy(series, INTERVAL_HOURS),
    quality: qualityFrom(series, ["AC power (kW), hourly mean", "Expected power (kW), demo baseline model"]),
    alerts: d.alerts.filter((a) => a.siteId === id),
    cases: d.cases
      .filter((c) => c.siteId === id)
      .map((c) => ({
        id: c.id,
        title: c.title,
        statusLabel: CASE_STATUS_LABEL[c.status],
        owner: c.owner,
        verification: c.verification,
        note: c.verificationNote,
      })),
  };
}

export { WINDOW_HOURS };
