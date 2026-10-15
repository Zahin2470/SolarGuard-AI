/** Alert service boundary. Backed by demo fixtures until the API exists. */
import type { PowerPoint } from "../domain";
import {
  buildFleetData,
  type AlertSummary,
  type RecoveryCaseSummary,
} from "../fixtures";

export interface AlertList {
  source: "demo" | "api";
  now: number;
  alerts: AlertSummary[];
}

export interface AlertDetail {
  source: "demo" | "api";
  now: number;
  alert: AlertSummary;
  series: PowerPoint[];
  linkedCase: RecoveryCaseSummary | null;
}

export async function getAlerts(): Promise<AlertList> {
  const d = buildFleetData();
  return { source: "demo", now: d.now, alerts: d.alerts };
}

export async function listAlertIds(): Promise<string[]> {
  return buildFleetData().alerts.map((a) => a.id);
}

export async function getAlertDetail(id: string): Promise<AlertDetail | null> {
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
