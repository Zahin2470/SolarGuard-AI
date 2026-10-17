# SolarGuard AI: web app (Phase 4)

Two kinds of screens, labelled in the top bar:

- **Live API data**: Recovery Cases (queue, case detail, workflow actions, verification) and Upload data. These read and write the FastAPI backend.
- **Demo data**: Overview, Sites, Alerts. Deterministic fixtures, not customer telemetry. They are **not** connected to the backend yet, so a site or alert you upload will not appear there.

Nothing on a demo screen is a measured result.

## Run

```bash
npm install
cp .env.example .env.local     # set SOLARGUARD_API_URL (and SOLARGUARD_API_KEY if the API uses one)
npm run dev                    # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

Backend (separate folder): `uvicorn app.main:app --port 8000`, then `SOLARGUARD_API_URL=http://localhost:8000`.
Both variables are server-only: the API key never reaches the browser. Without `SOLARGUARD_API_URL` the live screens show a "not connected" state; they never fall back to sample cases.

Node 22+, Next.js 16 (app router), React 19, Tailwind 4, Recharts, lucide-react.

## What exists

| Area | Where |
|---|---|
| Design tokens (colour, radius, shadow, layout) | `src/app/globals.css` (`@theme`) |
| Primitives: `Panel`, `MetricCard`, `StatusChip`, `ImpactStatusLabel`, `Skeleton`, `EmptyState`, `ErrorState`, `PageHeader` | `src/components/ui/` |
| App shell: sidebar, topbar, mobile drawer, skip link | `src/components/shell/` |
| Fleet Overview | `src/app/page.tsx`, `src/components/overview/` |
| Sites list and Site Detail (`/sites`, `/sites/[id]`) | `src/app/sites/`, `src/lib/api/sites.ts` |
| Alert Center and Alert Detail (`/alerts`, `/alerts/[id]`) | `src/app/alerts/`, `src/components/alerts/`, `src/lib/api/alerts.ts` |
| Shared chart (gaps for no-data, evidence-window shading, table view) | `src/components/overview/PowerChart.tsx` |
| Loading / error states | `src/app/loading.tsx`, `src/app/error.tsx` |
| Domain maths (kW to kWh integration, priority rule) | `src/lib/domain.ts` |
| Service boundary (swap for FastAPI client later) | `src/lib/api/fleet.ts` |
| Demo fixtures (no `Math.random`, no `Date.now`) | `src/lib/fixtures.ts` |

### Phase 4 additions

| Area | Where |
|---|---|
| Typed server-side API client (timeouts, error mapping, `X-API-Key`) | `src/lib/api/client.ts`, `live.ts`, `types.ts` |
| Recovery Cases queue + alerts awaiting triage | `src/app/recovery-cases/page.tsx`, `src/components/cases/CaseQueue.tsx`, `AlertTriage.tsx` |
| Case detail: evidence chart, status-specific actions, estimates, outcome, audit timeline | `src/app/recovery-cases/[id]/`, `CaseActions.tsx`, `CaseEstimates.tsx`, `VerificationPanel.tsx`, `CaseTimeline.tsx` |
| Server actions (validate, call API, revalidate) | `src/app/recovery-cases/actions.ts`, `src/app/upload/actions.ts` |
| CSV upload with site registration and ingest report | `src/app/upload/`, `src/components/cases/UploadForm.tsx` |

Reports & Impact is still a labelled "not built yet" page, with no placeholder numbers.

## Truthfulness rules implemented

- Every figure carries an evidence label: Detected / Estimated / Potentially recoverable / Action recorded / Measured / Verified / Not yet verified / Inconclusive / Demo data.
- Energy is computed as mean kW x interval hours, over intervals with data only, for both actual and expected.
- Missing data is a gap, never a zero. Fleet totals exclude non-reporting sites for both series and the chart marks the affected period.
- Case priority = severity tier, then confidence x potentially recoverable kWh/day. No tuned weights; documented as a demo rule to validate.
- Recoverable fractions (80% / 60%) in the fixtures are labelled demo assumptions.
- No tariff, currency or carbon figures yet: no sourced inputs exist.

### Live-screen behaviour worth knowing

- Only actions valid for the case's current status are shown; the API still enforces the state machine (409 on invalid jumps).
- Rejecting needs a reason, assigning needs an owner, resolving needs the action taken, a recoverable share needs a rationale. Recoverable energy stays "Not estimated yet" until a person supplies both.
- Resolving records the action; it does not claim success. The outcome comes only from the verification check, shown exactly as the API returns it (Verified / Outcome inconclusive / Not verifiable yet) with window tables and limitations. A derived baseline can never reach Verified.
- Action times entered in the form are read as Asia/Dhaka (UTC+6). "Acting as" is a self-declared name for the audit trail, not a login.
- Forms keep what you typed when the API or validation returns an error.

## Not done yet

- Overview, Sites and Alerts still run on fixtures; they do not read the backend. Their priority rule (confidence-weighted) differs from the backend's (severity, then estimated gap) until they are connected.
- No authentication or roles. "Acting as" is not an identity.
- `/recovery-cases/NOPE` and the demo `/sites/NOPE` return HTTP 200 with the not-found UI (streaming); not fixed.
- Alerts have no model anomaly score (rule-based detector); the page says so.
- No unit tests yet, and the live-screen flows were checked with a scripted headless-browser run (not committed as a test suite). Domain functions in `src/lib/domain.ts` are pure and ready for them).
- Charts have no automated visual-regression test. Layout was checked manually at 1440, 820 and 390 px widths.

## Next phase

Connect Overview, Sites and Alerts to the API, then Reports & Impact (ledger of verified, measured and potential figures, kept separate), then frontend tests.
