import "server-only";

import type { ChartPoint } from "@/components/overview/PowerChart";
import { summariseEnergy } from "../domain";
import type { ActivityItem, SiteSummary } from "../fixtures";
import { formatAgo, formatDayTime } from "../format";
import { LIVE_CASE_STATUS_LABEL, OPEN_CASE_STATUSES } from "../labels";
import type { AlertRow, CasePipeline, SiteCaseRow } from "../view";
import { ApiError } from "./client";
import { getAlert, getCase, getSite, getSitesSummary, getTelemetry, listAlerts, listCases, listSites } from "./live";
import { settle } from "./settle";
import type { ApiAlert, ApiCase, ApiSite, ApiSiteDataSummary, ApiTelemetryRow } from "./types";

const HOUR = 3_600_000;
export const WINDOW_HOURS = 72;
/** A site with no data for this long (by the wall clock) is shown as not reporting. */
export const STALE_AFTER_HOURS = 6;

export const NOT_IN_DATA = [
  "Irradiance and module temperature",
  "String-level current and voltage",
  "Inverter status codes",
  "Curtailment / export-limit flags",
  "Maintenance records beyond recovery cases",
];

function ts(iso: string | null): number | null {
  return iso ? Date.parse(iso) : null;
}

/** Fill every hour of [endHour - (hours-1)h, endHour] so missing rows are visible gaps, never skipped. */
export function toSlots(rows: ApiTelemetryRow[], endHour: number, hours = WINDOW_HOURS): ChartPoint[] {
  const byTs = new Map(rows.map((r) => [Date.parse(r.ts), r]));
  const out: ChartPoint[] = [];
  for (let k = hours - 1; k >= 0; k -= 1) {
    const t = endHour - k * HOUR;
    const r = byTs.get(t);
    out.push({ t, actualKw: r?.actual_kw ?? null, expectedKw: r?.expected_kw ?? null });
  }
  return out;
}

async function fetchSlots(siteId: string, endHour: number, hours = WINDOW_HOURS): Promise<ChartPoint[]> {
  const from = endHour - (hours - 1) * HOUR;
  const rows = await getTelemetry(siteId, new Date(from).toISOString(), new Date(endHour + HOUR).toISOString());
  return toSlots(rows, endHour, hours);
}

function sourceText(sources: string[]): string {
  if (sources.length === 0) return "No expected-power values stored";
  const parts = sources.map((s) =>
    s === "provided"
      ? "provided with the upload (independent)"
      : "derived from the site's own recent history",
  );
  return `Expected power (kW): ${parts.join("; ")}`;
}

interface SiteSummaryInput {
  site: ApiSite;
  summary: ApiSiteDataSummary | undefined;
  /** Hourly slots used for the 24 h figures (only the last 24 are read). */
  slots: ChartPoint[];
  alerts: ApiAlert[];
  cases: ApiCase[];
  now: number;
}

function siteSummary(i: SiteSummaryInput): SiteSummary {
  const lastData = ts(i.summary?.last_hour_with_data ?? null);
  const stale = lastData === null || i.now - (lastData + HOUR) > STALE_AFTER_HOURS * HOUR;
  const open = i.alerts.filter((a) => a.site_id === i.site.id && a.status === "open");
  const worst =
    open.find((a) => a.severity === "critical") ?? open.find((a) => a.severity === "warning") ?? null;

  let status: SiteSummary["status"] = "healthy";
  let statusReason = `No open alerts. Data received within the last ${STALE_AFTER_HOURS} hours.`;
  if (stale) {
    status = "stale";
    statusReason =
      lastData === null
        ? "No telemetry has been uploaded for this site."
        : `No data since ${formatDayTime(lastData + HOUR)} (${formatAgo(lastData + HOUR, i.now)}).`;
  } else if (worst) {
    status = worst.severity === "critical" ? "critical" : "warning";
    statusReason = `${worst.title} (${worst.id}).`;
  }

  const last24 = i.slots.slice(-24);
  const e = summariseEnergy(last24, 1);
  const lastReported = [...last24].reverse().find((p) => p.actualKw !== null);

  return {
    id: i.site.id,
    name: i.site.name,
    location: i.site.location ?? "Location not set",
    capacityKwp: i.site.capacity_kwp,
    status,
    statusReason,
    latestKw: lastReported?.actualKw ?? null,
    latestAt: lastReported?.t ?? null,
    actualKwh24h: e.actualKwh,
    expectedKwh24h: e.expectedKwh,
    gapKwh24h: e.gapKwh,
    performanceRatioPct: e.expectedKwh > 0 ? (e.actualKwh / e.expectedKwh) * 100 : null,
    skippedIntervals24h: e.skippedIntervals,
    openCases: i.cases.filter((c) => c.site_id === i.site.id && OPEN_CASE_STATUSES.includes(c.status)).length,
  };
}

export function toAlertRow(a: ApiAlert, siteName: string): AlertRow {
  const from = Date.parse(a.window_from);
  const to = Date.parse(a.window_to);
  return {
    id: a.id,
    siteId: a.site_id,
    siteName,
    severity: a.severity,
    status: a.status === "closed" ? "closed" : "open",
    title: a.title,
    detectedAt: Date.parse(a.detected_at),
    persistence: `${a.persistence_hours} h`,
    deviationPct: a.deviation_pct,
    evidence: a.evidence.length ? a.evidence : ["No evidence text recorded."],
    caseId: a.case_id,
    windowLabel: `${formatDayTime(from)} to ${formatDayTime(to)}`,
  };
}

export function toCaseRow(c: ApiCase): SiteCaseRow {
  return {
    id: c.id,
    title: c.title,
    statusLabel: LIVE_CASE_STATUS_LABEL[c.status],
    owner: c.owner,
    verification: c.verification_status,
    note: c.status === "resolved" ? c.verification_detail?.summary : undefined,
    href: `/recovery-cases/${c.id}`,
  };
}

export function casePipeline(cases: ApiCase[]): CasePipeline {
  return {
    needsReview: cases.filter((c) => c.status === "needs_review" || c.status === "inconclusive").length,
    actionAssigned: cases.filter((c) => c.status === "action_assigned" || c.status === "confirmed").length,
    inProgress: cases.filter((c) => c.status === "in_progress").length,
    resolved: cases.filter((c) => c.status === "resolved").length,
    verified: cases.filter((c) => c.verification_status === "verified").length,
    inconclusive: cases.filter((c) => c.status === "resolved" && c.verification_status === "inconclusive").length,
  };
}

function activityFrom(alerts: ApiAlert[], cases: ApiCase[], siteName: (id: string) => string): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const a of alerts) {
    items.push({
      id: `alert-${a.id}`,
      at: Date.parse(a.detected_at),
      text: `${a.id} detected at ${siteName(a.site_id)}: ${a.title}.`,
    });
  }
  for (const c of cases) {
    items.push({ id: `case-open-${c.id}`, at: Date.parse(c.created_at), text: `${c.id} opened for ${siteName(c.site_id)}.`, caseId: c.id });
    if (c.updated_at !== c.created_at) {
      items.push({
        id: `case-upd-${c.id}`,
        at: Date.parse(c.updated_at),
        text: `${c.id} last updated: ${LIVE_CASE_STATUS_LABEL[c.status]}${c.owner ? ` (owner ${c.owner})` : ""}.`,
        caseId: c.id,
      });
    }
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 8);
}

/* ------------------------------------------------------------------------------------------- */

export interface LiveFleet {
  now: number;
  sites: SiteSummary[];
  series: ChartPoint[];
  /** End of the last hour that has data for any site; null when nothing has been uploaded. */
  dataThrough: number | null;
  /** Sites that have any telemetry; the fleet chart measures "not all reporting" against this. */
  sitesWithData: number;
  activity: ActivityItem[];
  alertRows: AlertRow[];
  cases: ApiCase[];
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
}

export async function loadLiveFleet(): Promise<LiveFleet> {
  const [sites, summaries, alerts, cases] = await Promise.all([
    listSites(),
    getSitesSummary(),
    listAlerts(),
    listCases("priority"),
  ]);
  const now = Date.now(); // request time: apiFetch awaited connection() above
  const summaryById = new Map(summaries.map((s) => [s.site_id, s]));
  const lastHours = summaries.map((s) => ts(s.last_hour_with_data)).filter((x): x is number => x !== null);
  const endHour = lastHours.length ? Math.max(...lastHours) : null;

  const slotsBySite = new Map<string, ChartPoint[]>();
  if (endHour !== null) {
    await Promise.all(
      sites.map(async (s) => {
        slotsBySite.set(s.id, await fetchSlots(s.id, endHour));
      }),
    );
  }

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const siteSummaries = sites.map((site) =>
    siteSummary({ site, summary: summaryById.get(site.id), slots: slotsBySite.get(site.id) ?? [], alerts, cases, now }),
  );

  // Fleet series: per hour, sum only sites with BOTH actual and expected, so totals stay like-for-like.
  const series: ChartPoint[] = [];
  if (endHour !== null) {
    for (let k = WINDOW_HOURS - 1; k >= 0; k -= 1) {
      const t = endHour - k * HOUR;
      let actual = 0;
      let expected = 0;
      let reporting = 0;
      for (const s of sites) {
        const p = slotsBySite.get(s.id)?.[WINDOW_HOURS - 1 - k];
        if (p && p.actualKw !== null && p.expectedKw !== null) {
          actual += p.actualKw;
          expected += p.expectedKw;
          reporting += 1;
        }
      }
      series.push(
        reporting === 0
          ? { t, actualKw: null, expectedKw: null, reporting }
          : { t, actualKw: actual, expectedKw: expected, reporting },
      );
    }
  }

  const latest = series[series.length - 1];
  const sum = siteSummaries.reduce(
    (acc, s) => ({
      actual: acc.actual + s.actualKwh24h,
      expected: acc.expected + s.expectedKwh24h,
    }),
    { actual: 0, expected: 0 },
  );
  const openCases = cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status));

  return {
    now,
    sites: siteSummaries,
    series,
    dataThrough: endHour === null ? null : endHour + HOUR,
    sitesWithData: lastHours.length,
    activity: activityFrom(alerts, cases, siteName),
    alertRows: alerts.map((a) => toAlertRow(a, siteName(a.site_id))),
    cases,
    kpis: {
      sitesTotal: sites.length,
      sitesReporting: latest?.reporting ?? 0,
      sitesNeedingAttention: siteSummaries.filter((s) => s.status !== "healthy").length,
      latestFleetKw: latest?.actualKw ?? null,
      expectedFleetKwAtLatest: latest?.expectedKw ?? null,
      energy24h: {
        actualKwh: sum.actual,
        expectedKwh: sum.expected,
        gapKwh: sum.expected - sum.actual,
        gapPct: sum.expected > 0 ? ((sum.expected - sum.actual) / sum.expected) * 100 : null,
      },
      openCases: openCases.length,
      casesNeedingReview: openCases.filter((c) => c.status === "needs_review" || c.status === "inconclusive").length,
    },
  };
}

/* ------------------------------------------------------------------------------------------- */

export interface LiveSiteDetail {
  now: number;
  site: SiteSummary;
  series: ChartPoint[];
  alerts: AlertRow[];
  cases: SiteCaseRow[];
  baselineSources: string[];
  present: string[];
}

/** null = the site does not exist. Other failures throw. */
export async function loadLiveSiteDetail(id: string): Promise<LiveSiteDetail | null> {
  const siteRes = await settle(getSite(id));
  if (!siteRes.ok) {
    if (siteRes.error instanceof ApiError && siteRes.error.status === 404) return null;
    throw siteRes.error;
  }
  const site = siteRes.value;
  const [summaries, alerts, cases] = await Promise.all([getSitesSummary(), listAlerts(undefined, id), listCases("newest", id)]);
  const now = Date.now();
  const summary = summaries.find((s) => s.site_id === id);
  const last = ts(summary?.last_hour_with_data ?? null);
  const series = last === null ? [] : await fetchSlots(id, last);

  return {
    now,
    site: siteSummary({ site, summary, slots: series, alerts, cases, now }),
    series,
    alerts: alerts.map((a) => toAlertRow(a, site.name)),
    cases: cases.map(toCaseRow),
    baselineSources: summary?.expected_sources ?? [],
    present: ["AC power (kW), hourly mean", sourceText(summary?.expected_sources ?? [])],
  };
}

/* ------------------------------------------------------------------------------------------- */

export interface LiveAlertDetail {
  now: number;
  alert: ApiAlert;
  siteName: string;
  series: ChartPoint[];
  linkedCase: ApiCase | null;
  derivedBaseline: boolean;
}

export async function loadLiveAlertDetail(id: string): Promise<LiveAlertDetail | null> {
  const alertRes = await settle(getAlert(id));
  if (!alertRes.ok) {
    if (alertRes.error instanceof ApiError && alertRes.error.status === 404) return null;
    throw alertRes.error;
  }
  const alert = alertRes.value;
  const [siteRes, caseRes] = await Promise.all([
    settle(getSite(alert.site_id)),
    alert.case_id ? settle(getCase(alert.case_id)) : Promise.resolve(null),
  ]);
  const wf = Date.parse(alert.window_from);
  const wt = Date.parse(alert.window_to);
  const end = wt + 11 * HOUR; // up to 12 h after the evidence window
  const hours = Math.min(WINDOW_HOURS, Math.round((end - wf) / HOUR) + 25);
  const rows = await getTelemetry(
    alert.site_id,
    new Date(end - (hours - 1) * HOUR).toISOString(),
    new Date(end + HOUR).toISOString(),
  );
  return {
    now: Date.now(),
    alert,
    siteName: siteRes.ok ? siteRes.value.name : alert.site_id,
    series: toSlots(rows, end, hours),
    linkedCase: caseRes && caseRes.ok ? caseRes.value : null,
    derivedBaseline: rows.some((r) => r.expected_source !== null && r.expected_source !== "provided"),
  };
}
