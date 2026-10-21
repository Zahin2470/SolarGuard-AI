# SolarGuard AI: web app (Phase 5)

Every data page shows a source badge:

- **Live API data**: all screens when `SOLARGUARD_API_URL` is set (Overview, Sites, Site detail, Alerts, Alert detail, Recovery Cases, Upload).
- **Demo data**: Overview, Sites and Alerts fall back to deterministic fixtures **only when no API is configured**. If an API is configured but unreachable, the page shows an error; it never substitutes demo data. Recovery Cases and Upload need the API and show "not connected" without it.

Nothing on a demo screen is customer telemetry or a measured result.

## Run

```bash
npm install
cp .env.example .env.local     # set SOLARGUARD_API_URL (and SOLARGUARD_API_KEY if the API uses one)
npm run dev                    # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

Backend (separate folder): `uvicorn app.main:app --port 8000`, then `SOLARGUARD_API_URL=http://localhost:8000`.
Both variables are server-only: the API key never reaches the browser.

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

### Phase 5: live Overview, Sites, Alerts

| Area | Where |
|---|---|
| Live/demo dispatch per screen | `src/lib/api/fleet.ts`, `sites.ts`, `alerts.ts` |
| API to view-model adapters (site status, fleet series, 24 h figures, alert rows) | `src/lib/api/live-fleet.ts` |
| Shared view models so lists never need fields one source cannot supply | `src/lib/view.ts` |
| Live alert detail (no invented cause or confidence) | `src/components/alerts/LiveAlertDetail.tsx` (demo: `DemoAlertDetail.tsx`) |
| Live priority cases, stale-data notice, source badge | `src/components/overview/LivePriorityCases.tsx`, `ui/StaleDataNotice.tsx`, `ui/SourceBadge.tsx` |

How live figures are derived (so you can challenge them):

- **Time anchor.** Fleet chart, 24 h figures and site series end at the latest hour that has data. If that is older than 6 hours, a notice says so and the figures describe that last period, not the present.
- **Site status.** Not reporting = no data for 6 hours by the wall clock (or never uploaded). Otherwise critical or warning from the worst *open* alert, else healthy. Closed alerts do not change status.
- **Energy.** mean kW x 1 h over hours with both an actual and an expected value, for actual and expected alike. Missing hours are gaps and are counted as skipped.
- **Fleet series.** Per hour, sums only sites with both values; hours where no site qualifies are blank, not zero. "Not all sites reporting" is judged against sites that have any telemetry.
- **Alerts.** Shown as detected deviations. The rule-based detector supplies no cause, confidence or recommended check, so none is displayed; a person records a hypothesis on the recovery case.
- **Activity feed.** Alert detections and each case's opened and last-updated events (the list endpoint carries no full history).

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

- Live Overview, Sites and Alerts make several API calls per render (one telemetry call per site). Fine for a pilot; a large fleet needs a server-side summary endpoint.
- The demo fixtures still rank cases by confidence x recoverable energy; live data ranks by severity, then estimated gap (no confidence exists).
- No authentication or roles. "Acting as" is not an identity.
- Unknown ids (`/sites/NOPE`, `/alerts/AL-9999`, `/recovery-cases/RC-9999`) show the not-found page but return HTTP 200 (streaming); not fixed.
- Alerts have no model anomaly score (rule-based detector); the page says so.
- No unit tests yet, and the live-screen flows were checked with a scripted headless-browser run (not committed as a test suite). Domain functions in `src/lib/domain.ts` are pure and ready for them).
- Charts have no automated visual-regression test. Layout was checked manually at 1440, 820 and 390 px widths.

## Next phase

Reports & Impact (ledger of verified, measured and potential figures, kept separate), then frontend tests.
