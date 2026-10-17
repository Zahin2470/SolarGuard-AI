/**
 * Wire types for the SolarGuard FastAPI backend (backend/app/schemas.py).
 * Field names stay snake_case so they match the JSON one-to-one.
 */

export interface ApiSite {
  id: string;
  name: string;
  location: string | null;
  capacity_kwp: number;
  created_at: string;
}

export interface ApiTelemetryRow {
  ts: string;
  actual_kw: number | null;
  expected_kw: number | null;
  expected_source: "provided" | "derived" | null;
}

export interface ApiAlert {
  id: string;
  site_id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  status: string;
  detected_at: string;
  window_from: string;
  window_to: string;
  persistence_hours: number;
  deviation_pct: number | null;
  est_gap_kwh: number | null;
  evidence: string[];
  detector: string;
  case_id: string | null;
  labels: Record<string, string>;
}

export interface ApiIngestReport {
  rows_received: number;
  rows_rejected: number;
  rejected_samples: { line: number; reason: string }[];
  duplicates_dropped: number;
  interval_minutes: number;
  hours_stored: number;
  hours_with_actual: number;
  hours_without_actual: number;
  first_hour: string | null;
  last_hour: string | null;
  expected_source: string;
  warnings: string[];
}

export interface ApiUploadResult {
  ingest: ApiIngestReport;
  alerts: ApiAlert[];
}

export type ApiCaseStatus =
  | "needs_review"
  | "confirmed"
  | "rejected"
  | "inconclusive"
  | "action_assigned"
  | "in_progress"
  | "resolved";

export type ApiVerificationStatus =
  | "not_yet_verified"
  | "verified"
  | "inconclusive"
  | "not_verifiable";

export interface ApiCaseEvent {
  at: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  note: string | null;
}

export interface ApiVerificationWindow {
  from: string;
  to: string;
  valid_production_hours: number;
  actual_kwh: number;
  expected_kwh: number;
  performance_ratio: number | null;
  baseline_sources: string[];
}

export interface ApiVerificationDetail {
  method: string;
  summary: string;
  pre_window: ApiVerificationWindow;
  post_window: ApiVerificationWindow;
  delta_performance_ratio_pts?: number;
  measured_incremental_kwh_post_window?: number;
  baseline_independent?: boolean;
  limitations: string[];
  computed_at: string;
}

export interface ApiCase {
  id: string;
  alert_id: string;
  site_id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: ApiCaseStatus;
  probable_cause: string | null;
  est_gap_kwh: number | null;
  recoverable_fraction: number | null;
  recoverable_kwh: number | null;
  recoverable_rationale: string | null;
  owner: string | null;
  rejection_reason: string | null;
  action_taken: string | null;
  action_started_at: string | null;
  action_completed_at: string | null;
  verification_status: ApiVerificationStatus;
  verification_level: string | null;
  verification_detail: ApiVerificationDetail | null;
  created_at: string;
  updated_at: string;
  rank_reason: string | null;
  labels: Record<string, string>;
  events: ApiCaseEvent[] | null;
}
