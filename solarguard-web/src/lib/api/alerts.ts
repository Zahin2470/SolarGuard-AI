/** Alert service boundary. Live when SOLARGUARD_API_URL is set, else demo fixtures. */
import type { ChartPoint } from "@/components/overview/PowerChart";
import { buildFleetData, type AlertSummary, type RecoveryCaseSummary } from "../fixtures";
import type { AlertRow } from "../view";
import { isLive } from "./client";
import { loadLiveFleet, loadLiveAlertDetail } from "./live-fleet";
import type { ApiAlert, ApiCase } from "./types";

export interface AlertList {
  source: "demo" | "api";
  now: number;
  alerts: AlertRow[];
}

export type AlertDetail =
  | {
      source: "demo";
      now: number;
      alert: AlertSummary;
      series: ChartPoint[];
      linkedCase: RecoveryCaseSummary | null;
    }
  | {
      source: "api";
      now: number;
      alert: ApiAlert;
      siteName: string;
      series: ChartPoint[];
      linkedCase: ApiCase | null;
      derivedBaseline: boolean;
    };

export async function getAlerts(): Promise<AlertList> {
  if (await isLive()) {
    const f = await loadLiveFleet();
    return { source: "api", now: f.now, alerts: f.alertRows };
  }
  const d = buildFleetData();
  return { source: "demo", now: d.now, alerts: d.alerts };
}

export async function getAlertDetail(id: string): Promise<AlertDetail | null> {
  if (await isLive()) {
    const d = await loadLiveAlertDetail(id);
    return d ? { source: "api", ...d } : null;
  }
  const d = buildFleetData();
  const alert = d.alerts.find((a) => a.id === id);
  if (!alert) return null;
  return {
    source: "demo",
    now: d.now,
    alert,
    series: d.siteSeries[alert.siteId],
    linkedCase: d.cases.find((c) => c.id === alert.caseId) ?? null,
  };
}
