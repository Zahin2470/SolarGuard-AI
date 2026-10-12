/**
 * Deterministic DEMO fixtures. Nothing here is customer data or a measured result.
 * Values are generated from fixed formulas (no Math.random, no Date.now) so every render is identical,
 * and everything shown on the Fleet Overview (KPIs, chart, cases) derives from the same series.
 *
 * Replace this module's consumer (src/lib/api/fleet.ts) with a real API client when the backend exists.
 */
import {
  summariseEnergy,
  type CaseStatus,
  type PowerPoint,
  type Severity,
  type SiteStatus,
  type VerificationStatus,
} from "./domain";

const HOUR = 3_600_000;
const TZ_OFFSET = 6 * HOUR; // Asia/Dhaka, no DST

/** "Now" for the demo: 10 Oct 2026, 10:00 Asia/Dhaka. Last complete interval starts at 09:00. */
export const DEMO_NOW = Date.UTC(2026, 9, 10, 4, 0, 0);
export const INTERVAL_HOURS = 1;
const HISTORY_HOURS = 72;

function fract(x: number): number {
  return x - Math.floor(x);
}

/** Deterministic pseudo-noise in [-1, 1]. */
function jitter(i: number, seed: number): number {
  return (fract(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) - 0.5) * 2;
}

function localHourMid(t: number): number {
  return new Date(t + TZ_OFFSET).getUTCHours() + 0.5;
}

function localDayIndex(t: number): number {
  return Math.floor((t + TZ_OFFSET) / (24 * HOUR));
}

function clearSky(hour: number): number {
  if (hour <= 6 || hour >= 18) return 0;
  return Math.sin((Math.PI * (hour - 6)) / 12);
}

/** Day-level weather factor applied to the expected-power model (cloudier yesterday). */
function weatherFactor(t: number, i: number): number {
  const daysAgo = localDayIndex(DEMO_NOW) - localDayIndex(t);
  if (daysAgo === 0) return 0.97;
  if (daysAgo === 1) return 0.8 + jitter(i, 3) * 0.05;
  return 0.93;
}

interface SiteSpec {
  id: string;
  name: string;
  location: string;
  capacityKwp: number;
  /** Multiplier applied to expected power to produce the demo "actual". */
  baseFactor: number;
  fault?: { startsAt: number; factor: number };
  /** Site stops reporting from this time (interval start, inclusive). */
  silentFrom?: number;
  seed: number;
}

const SITE_SPECS: SiteSpec[] = [
  {
    id: "DEMO-01",
    name: "Factory Rooftop A",
    location: "Gazipur",
    capacityKwp: 420,
    baseFactor: 0.995,
    fault: { startsAt: DEMO_NOW - 30 * HOUR, factor: 0.81 },
    seed: 1,
  },
  {
    id: "DEMO-02",
    name: "Textile Mill B",
    location: "Narayanganj",
    capacityKwp: 650,
    baseFactor: 0.925,
    seed: 2,
  },
  {
    id: "DEMO-03",
    name: "Hospital Roof",
    location: "Dhaka",
    capacityKwp: 180,
    baseFactor: 0.995,
    seed: 3,
  },
  {
    id: "DEMO-04",
    name: "University Campus",
    location: "Dhaka",
    capacityKwp: 300,
    baseFactor: 0.99,
    seed: 4,
  },
  {
    id: "DEMO-05",
    name: "Shopping Mall Rooftop",
    location: "Chattogram",
    capacityKwp: 240,
    baseFactor: 0.975,
    silentFrom: DEMO_NOW - 5 * HOUR,
    seed: 5,
  },
  {
    id: "DEMO-06",
    name: "Warehouse C",
    location: "Savar",
    capacityKwp: 510,
    baseFactor: 0.985,
    seed: 6,
  },
];

function buildSiteSeries(spec: SiteSpec): PowerPoint[] {
  const points: PowerPoint[] = [];
  for (let k = HISTORY_HOURS; k >= 1; k -= 1) {
    const t = DEMO_NOW - k * HOUR;
    const i = HISTORY_HOURS - k;
    const sky = clearSky(localHourMid(t));
    const expected = spec.capacityKwp * 0.82 * sky * weatherFactor(t, i);
    let factor = spec.baseFactor;
    if (spec.fault && t >= spec.fault.startsAt) factor = spec.fault.factor;
    const noise = 1 + jitter(i, spec.seed) * 0.012;
    const silent = spec.silentFrom !== undefined && t >= spec.silentFrom;
    points.push({
      t,
      expectedKw: round1(expected),
      actualKw: silent ? null : round1(expected * factor * noise),
    });
  }
  return points;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export interface SiteSummary {
  id: string;
  name: string;
  location: string;
  capacityKwp: number;
  status: SiteStatus;
  statusReason: string;
  /** Latest interval that actually reported (kW) and when that interval started. */
  latestKw: number | null;
  latestAt: number | null;
  /** Last 24 h, valid intervals only. */
  actualKwh24h: number;
  expectedKwh24h: number;
  gapKwh24h: number;
  /** actual / expected over valid intervals, percent. */
  performanceRatioPct: number | null;
  skippedIntervals24h: number;
  openCases: number;
}

export interface RecoveryCaseSummary {
  id: string;
  siteId: string;
  siteName: string;
  title: string;
  severity: Severity;
  status: CaseStatus;
  /** Model confidence in the candidate cause (0-1). Demo value, not calibrated. */
  confidence: number;
  evidence: string[];
  /** Estimated gap over the last 24 h; null when data is insufficient. */
  estimatedGapKwh24h: number | null;
  /** Estimated potentially recoverable energy per day; null when not estimable. */
  recoverableKwhPerDay: number | null;
  recoverableRationale: string;
  nextAction: string;
  whatWouldDisconfirm: string;
  owner: string | null;
  verification: VerificationStatus;
  verificationNote?: string;
  persistenceNote: string;
}

export interface ActivityItem {
  id: string;
  at: number;
  text: string;
  caseId?: string;
}

export interface FleetPoint {
  t: number;
  actualKw: number;
  expectedKw: number;
  reporting: number;
}

export interface FleetData {
  sites: SiteSummary[];
  cases: RecoveryCaseSummary[];
  activity: ActivityItem[];
  series: FleetPoint[];
  now: number;
  sitesTotal: number;
}

function last24h(points: PowerPoint[]): PowerPoint[] {
  return points.slice(-24);
}

function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function buildFleetData(): FleetData {
  const siteSeries = new Map<string, PowerPoint[]>();
  for (const spec of SITE_SPECS) siteSeries.set(spec.id, buildSiteSeries(spec));

  // Fleet series: sum only the sites that reported in that interval, for actual AND expected.
  const series: FleetPoint[] = [];
  for (let idx = 0; idx < HISTORY_HOURS; idx += 1) {
    let actual = 0;
    let expected = 0;
    let reporting = 0;
    let t = 0;
    for (const spec of SITE_SPECS) {
      const p = siteSeries.get(spec.id)![idx];
      t = p.t;
      if (p.actualKw === null) continue;
      actual += p.actualKw;
      expected += p.expectedKw;
      reporting += 1;
    }
    series.push({
      t,
      actualKw: round1(actual),
      expectedKw: round1(expected),
      reporting,
    });
  }

  const statusById: Record<string, { status: SiteStatus; reason: string }> = {
    "DEMO-01": { status: "critical", reason: "Persistent output shortfall" },
    "DEMO-02": { status: "warning", reason: "Uniform output shortfall" },
    "DEMO-03": { status: "healthy", reason: "Within expected range" },
    "DEMO-04": { status: "healthy", reason: "Within expected range" },
    "DEMO-05": { status: "stale", reason: "No data for 5 h" },
    "DEMO-06": { status: "healthy", reason: "Within expected range" },
  };

  const openCasesBySite: Record<string, number> = {
    "DEMO-01": 1,
    "DEMO-02": 1,
    "DEMO-05": 1,
  };

  const sites: SiteSummary[] = SITE_SPECS.map((spec) => {
    const pts = siteSeries.get(spec.id)!;
    const e = summariseEnergy(last24h(pts), INTERVAL_HOURS);
    let latest: PowerPoint | undefined;
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      if (pts[i].actualKw !== null) {
        latest = pts[i];
        break;
      }
    }
    return {
      id: spec.id,
      name: spec.name,
      location: spec.location,
      capacityKwp: spec.capacityKwp,
      status: statusById[spec.id].status,
      statusReason: statusById[spec.id].reason,
      latestKw: latest?.actualKw ?? null,
      latestAt: latest ? latest.t : null,
      actualKwh24h: e.actualKwh,
      expectedKwh24h: e.expectedKwh,
      gapKwh24h: e.gapKwh,
      performanceRatioPct:
        e.expectedKwh > 0 ? (e.actualKwh / e.expectedKwh) * 100 : null,
      skippedIntervals24h: e.skippedIntervals,
      openCases: openCasesBySite[spec.id] ?? 0,
    };
  });

  const s1 = sites.find((s) => s.id === "DEMO-01")!;
  const s2 = sites.find((s) => s.id === "DEMO-02")!;
  const s5 = sites.find((s) => s.id === "DEMO-05")!;

  const s1Fault = SITE_SPECS[0].fault!;
  const s1ProdHours = siteSeries
    .get("DEMO-01")!
    .filter((p) => p.t >= s1Fault.startsAt && p.expectedKw > 0).length;

  const cases: RecoveryCaseSummary[] = [
    {
      id: "RC-0007",
      siteId: s1.id,
      siteName: s1.name,
      title: "Suspected string-level output loss",
      severity: "critical",
      status: "needs_review",
      confidence: 0.78,
      evidence: [
        `Output ${pct(100 - (s1.performanceRatioPct ?? 100), 0)} below expected over the last 24 h`,
        `Shortfall persists across ${s1ProdHours} production hours, including clear-sky hours`,
        "No communication gap or known curtailment recorded for this site",
      ],
      estimatedGapKwh24h: s1.gapKwh24h,
      recoverableKwhPerDay: s1.gapKwh24h * 0.8,
      recoverableRationale:
        "Demo assumption: 80% of the gap is recoverable if a single string or combiner fault is confirmed.",
      nextAction: "Inspect combiner box and string currents before the next production day.",
      whatWouldDisconfirm:
        "A drifting irradiance sensor would produce the same pattern without a hardware fault; compare with a neighbouring site.",
      owner: null,
      verification: "not_yet_verified",
      persistenceNote: `${s1ProdHours} production hours`,
    },
    {
      id: "RC-0006",
      siteId: s2.id,
      siteName: s2.name,
      title: "Suspected soiling-related loss",
      severity: "warning",
      status: "action_assigned",
      confidence: 0.55,
      evidence: [
        `Output ${pct(100 - (s2.performanceRatioPct ?? 100), 1)} below expected, similar on all three days`,
        "Loss is uniform through the day, consistent with soiling but also with a derate or sensor offset",
      ],
      estimatedGapKwh24h: s2.gapKwh24h,
      recoverableKwhPerDay: s2.gapKwh24h * 0.6,
      recoverableRationale:
        "Demo assumption: 60% recoverable if cleaning is the right fix; cause not confirmed.",
      nextAction: "Visual inspection and cleaning trial; compare 7 days before and after.",
      whatWouldDisconfirm:
        "No improvement after cleaning would point to a derate, degradation or sensor offset instead.",
      owner: "O&M crew B",
      verification: "not_yet_verified",
      persistenceNote: "3 days",
    },
    {
      id: "RC-0008",
      siteId: s5.id,
      siteName: s5.name,
      title: "Site stopped reporting",
      severity: "warning",
      status: "needs_review",
      confidence: 0.9,
      evidence: [
        "No telemetry received for the last 5 hours",
        "Energy gap cannot be estimated until data resumes",
      ],
      estimatedGapKwh24h: null,
      recoverableKwhPerDay: null,
      recoverableRationale:
        "Insufficient data: cannot tell whether generation or only communication is affected.",
      nextAction: "Check logger / gateway connectivity and inverter status on site.",
      whatWouldDisconfirm:
        "Backfilled data showing normal output would mean this was a communication gap only.",
      owner: null,
      verification: "not_verifiable",
      verificationNote: "No telemetry in the window.",
      persistenceNote: "5 hours",
    },
    {
      id: "RC-0005",
      siteId: "DEMO-06",
      siteName: "Warehouse C",
      title: "Inverter trip and restart",
      severity: "info",
      status: "resolved",
      confidence: 0.85,
      evidence: ["Single-day production dip recorded by operator", "Inverter restarted by technician"],
      estimatedGapKwh24h: null,
      recoverableKwhPerDay: null,
      recoverableRationale: "Closed case.",
      nextAction: "None. Outcome recorded as inconclusive.",
      whatWouldDisconfirm: "n/a",
      owner: "O&M crew A",
      verification: "inconclusive",
      verificationNote:
        "Post-action window too short and weather differed from the pre-action window.",
      persistenceNote: "1 day",
    },
  ];

  const activity: ActivityItem[] = [
    {
      id: "a1",
      at: DEMO_NOW - 1 * HOUR,
      text: "RC-0008 opened: Shopping Mall Rooftop stopped reporting",
      caseId: "RC-0008",
    },
    {
      id: "a2",
      at: DEMO_NOW - 18 * HOUR,
      text: "RC-0006 assigned to O&M crew B",
      caseId: "RC-0006",
    },
    {
      id: "a3",
      at: DEMO_NOW - 26 * HOUR,
      text: "RC-0007 opened: Factory Rooftop A output shortfall detected",
      caseId: "RC-0007",
    },
    {
      id: "a4",
      at: DEMO_NOW - 98 * HOUR,
      text: "RC-0005 resolved, outcome inconclusive",
      caseId: "RC-0005",
    },
  ];

  return {
    sites,
    cases,
    activity,
    series,
    now: DEMO_NOW,
    sitesTotal: sites.length,
  };
}
