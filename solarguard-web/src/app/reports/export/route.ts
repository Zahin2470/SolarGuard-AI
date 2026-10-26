import { ApiError, ApiNotConfiguredError, ApiUnavailableError } from "@/lib/api/client";
import { listCases } from "@/lib/api/live";
import { toCsv } from "@/lib/csv";
import { buildLedger } from "@/lib/ledger";

const HEADER = [
  "case_id",
  "site_id",
  "title",
  "severity",
  "case_status",
  "evidence_level",
  "estimated_gap_kwh",
  "potentially_recoverable_kwh",
  "action_recorded",
  "action_completed_at_utc",
  "outcome",
  "performance_ratio_change_pts",
  "post_window_extra_kwh",
  "baseline_independent",
  "note",
];

/** Case ledger as CSV. Same figures and evidence levels as the Reports page. */
export async function GET() {
  let cases;
  try {
    cases = await listCases("newest");
  } catch (err) {
    if (err instanceof ApiNotConfiguredError) return new Response("API is not configured.", { status: 503 });
    if (err instanceof ApiUnavailableError || err instanceof ApiError) {
      return new Response(err.message, { status: 502 });
    }
    return new Response("Export failed.", { status: 500 });
  }

  const { rows } = buildLedger(cases);
  const body = toCsv(
    HEADER,
    rows.map((r) => [
      r.caseId,
      r.siteId,
      r.title,
      r.severity,
      r.status,
      r.level,
      r.estGapKwh,
      r.recoverableKwh,
      r.actionRecorded,
      r.actionCompletedAt,
      r.outcome,
      r.deltaPrPts,
      r.postWindowKwh,
      r.baselineIndependent,
      r.note,
    ]),
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solarguard-impact-ledger-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
