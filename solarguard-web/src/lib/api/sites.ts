/** Site service boundary: list + detail. Backed by demo fixtures until the API exists. */
import { summariseEnergy, type PowerPoint } from "../domain";
import {
  buildFleetData,
  INTERVAL_HOURS,
  type AlertSummary,
  type RecoveryCaseSummary,
  type SiteSummary,
} from "../fixtures";

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
  series: PowerPoint[];
  energy72h: ReturnType<typeof summariseEnergy>;
  quality: DataQuality;
  alerts: AlertSummary[];
  cases: RecoveryCaseSummary[];
}

export async function getSites(): Promise<SiteList> {
  const d = buildFleetData();
  return { source: "demo", now: d.now, sites: d.sites };
}

export async function listSiteIds(): Promise<string[]> {
  return buildFleetData().sites.map((s) => s.id);
}

export async function getSiteDetail(id: string): Promise<SiteDetail | null> {
  const d = buildFleetData();
  const site = d.sites.find((s) => s.id === id);
  if (!site) return null;
  const series = d.siteSeries[id];
  const received = series.filter((p) => p.actualKw !== null).length;
  const lastReported = [...series].reverse().find((p) => p.actualKw !== null);

  return {
    source: "demo",
    now: d.now,
    site,
    series,
    energy72h: summariseEnergy(series, INTERVAL_HOURS),
    quality: {
      windowHours: series.length,
      expectedIntervals: series.length,
      receivedIntervals: received,
      missingIntervals: series.length - received,
      completenessPct: (received / series.length) * 100,
      lastReportedEnd: lastReported ? lastReported.t + 3_600_000 : null,
      present: ["AC power (kW), hourly mean", "Expected power (kW), demo baseline model"],
      missing: [
        "Irradiance and module temperature",
        "String-level current and voltage",
        "Inverter status codes",
        "Curtailment / export-limit flags",
        "Maintenance records beyond recovery cases",
      ],
    },
    alerts: d.alerts.filter((a) => a.siteId === id),
    cases: d.cases.filter((c) => c.siteId === id),
  };
}
