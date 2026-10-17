# SolarGuard AI: backend (Phase 3, used by the Phase 4 web app)

FastAPI service for telemetry ingestion, rule-based detection, recovery cases and outcome verification.
SQLite by default; PostgreSQL through `DATABASE_URL`.

## Run

```bash
pip install -r requirements-dev.txt
python -m pytest -q                              # 35 tests
python scripts/make_demo_csv.py data             # two synthetic demo CSVs (not customer data)
uvicorn app.main:app --reload                    # http://localhost:8000/docs
```

Docker + Postgres: copy `.env.example` to `.env`, set `POSTGRES_PASSWORD`, then `docker compose up --build`.

## The closed loop, as API calls

| Step | Endpoint |
|---|---|
| Register a site | `POST /sites` |
| Upload CSV (validate, hourly resample, baseline, detect) | `POST /sites/{id}/telemetry` (multipart `file`, optional `timezone`) |
| Review alerts | `GET /alerts`, `GET /alerts/{AL-0001}` |
| Open a recovery case | `POST /alerts/{id}/case` |
| Correct cause / set a recoverable estimate | `PATCH /cases/{RC-0001}` |
| Confirm, reject, assign, start, resolve | `POST /cases/{id}/transition` |
| Verify the outcome | `POST /cases/{id}/verify` |
| Ranked queue with reason | `GET /cases?sort=priority` |

CSV columns: `timestamp` (ISO 8601), `power_kw` (blank = no data), optional `expected_kw`.

## Rules implemented (defaults, not validated values)

- **Validation:** rejects unparseable timestamps, non-numeric, negative or >150% of nameplate power. Duplicates dropped. Every rejection is reported with its line number.
- **Hourly normalisation:** sub-hourly data is averaged; an hour needs at least 75% of its samples, otherwise it is a gap. A gap is never stored as zero.
- **Baseline:** uses `expected_kw` when provided ("independent"). Otherwise a trailing same-hour median of the previous 3 to 7 days is derived from the site's own history.
- **Detection `rule_v1`:** at least 4 consecutive production hours (expected >= 5% of nameplate) that are >= 10% below expected. Night hours do not break a run; a production hour with missing data does. Critical when mean deviation >= 20%, else warning. A trailing no-data alert needs 3 hours. Thresholds are overridable on `POST /sites/{id}/detect`.
- **Energy:** gap = sum(expected - actual) x 1 h over valid production hours. Always labelled `estimated`.
- **Recoverable energy:** `null` until a person sets a fraction together with a written rationale. Then labelled `potential`.
- **Case lifecycle:** `needs_review -> confirmed | rejected | inconclusive`, `confirmed -> action_assigned -> in_progress -> resolved`. Rejecting needs a reason, assigning needs an owner, resolving needs the action taken. Invalid jumps return 409. Every change is an audit event.
- **Verification:** compares performance ratio (actual / expected over valid production hours) in a 7-day window before the action and a 7-day window after it.
  - `not_verifiable`: fewer than 12 valid production hours in either window.
  - `inconclusive` (level `measured`): improvement under 3 points, or the baseline is derived from the site's own history.
  - `verified`: improvement of at least 3 points against an independent `expected_kw`. This is association, not proof of cause; limitations are returned in the response.

## Limitations (read before trusting an output)

- The derived baseline can absorb a fault. In the bundled demo it splits one fault into two alerts and can never reach `verified`. This is by design, and the API says so.
- No model anomaly score, no fault diagnosis, no confidence value: a case is ranked by severity then estimated gap.
- Hours are bucketed in UTC; sites on a half-hour offset will be misaligned.
- No user accounts or roles. One optional shared `X-API-Key`. Tenant isolation is not implemented.
- Tables are created at startup; there are no migrations yet.
- Opening a case from an alert works whether the alert is still open or has ended; the web app lists every alert that has no case.
- Tested here with SQLite only. The Dockerfile, compose file and PostgreSQL path were written but not run in this environment (no Docker daemon, no Postgres).
- No tariff or carbon figures: no sourced inputs.
