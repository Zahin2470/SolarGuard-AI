# SolarGuard AI: web app (Phase 2)

Design system, app shell, Fleet Overview, Sites and Alert Center, running on deterministic **demo fixtures**.
Nothing shown is customer telemetry or a measured result.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

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

Recovery Cases and Reports & Impact are routed but show a clearly labelled "not built yet" page, with no placeholder numbers.

Alert and site pages are read-only: assigning owners, recording actions and closing cases need the backend.

## Truthfulness rules implemented

- Every figure carries an evidence label: Detected / Estimated / Potentially recoverable / Action recorded / Measured / Verified / Not yet verified / Inconclusive / Demo data.
- Energy is computed as mean kW x interval hours, over intervals with data only, for both actual and expected.
- Missing data is a gap, never a zero. Fleet totals exclude non-reporting sites for both series and the chart marks the affected period.
- Case priority = severity tier, then confidence x potentially recoverable kWh/day. No tuned weights; documented as a demo rule to validate.
- Recoverable fractions (80% / 60%) in the fixtures are labelled demo assumptions.
- No tariff, currency or carbon figures yet: no sourced inputs exist.

## Not done yet

- No backend, database, auth or CSV ingestion. Alert and case actions are therefore not available.
- Alerts have no model anomaly score (rule-based demo detector); the page says so.
- No unit tests yet (domain functions in `src/lib/domain.ts` are pure and ready for them).
- Charts have no automated visual-regression test. Layout was checked manually at 1440, 820 and 390 px widths.

## Next phase

FastAPI + PostgreSQL + CSV upload feeding the same service contracts (`fleet.ts`, `sites.ts`, `alerts.ts`), then the recovery-case workflow.
