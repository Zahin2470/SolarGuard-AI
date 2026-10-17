"""Rule-based detection (rule_v1): persistence of production-hour shortfalls and trailing no-data.

This is a transparent baseline detector, not a trained model. It produces NO anomaly score and
NO fault diagnosis: an alert is a signal that output stayed below expected, with the evidence.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import DetectionConfig
from ..db import utcnow
from ..models import Alert, Site, Telemetry

HOUR = timedelta(hours=1)
DETECTOR = "rule_v1"


@dataclass
class _Run:
    hours: list[Telemetry]

    @property
    def start(self) -> datetime:
        return self.hours[0].ts

    @property
    def end(self) -> datetime:
        return self.hours[-1].ts + HOUR


def _is_production(row: Telemetry, capacity_kwp: float, cfg: DetectionConfig) -> bool:
    return row.expected_kw is not None and row.expected_kw >= cfg.production_min_fraction * capacity_kwp


def find_underperformance_runs(
    rows: list[Telemetry], capacity_kwp: float, cfg: DetectionConfig
) -> tuple[list[_Run], bool]:
    """Runs of consecutive production hours with deviation >= threshold.

    Night hours (expected below the production threshold) neither extend nor break a run.
    A production hour with missing actual or missing baseline breaks the run.
    Returns (runs meeting min persistence, whether the last run is still ongoing at series end).
    """
    runs: list[_Run] = []
    current: list[Telemetry] = []
    ongoing = False

    def close() -> None:
        nonlocal current
        if len(current) >= cfg.min_persistence_hours:
            runs.append(_Run(list(current)))
        current = []

    last_eval_index = -1
    for i, row in enumerate(rows):
        if row.expected_kw is None:
            # No baseline: not evaluable. Treated as a break only if it is daytime-ish we cannot know.
            close()
            continue
        if not _is_production(row, capacity_kwp, cfg):
            continue  # night / very low expected: neither extends nor breaks
        last_eval_index = i
        if row.actual_kw is None:
            close()
            continue
        deviation = (row.expected_kw - row.actual_kw) / row.expected_kw * 100
        if deviation >= cfg.deviation_threshold_pct:
            current.append(row)
        else:
            close()

    if current and len(current) >= cfg.min_persistence_hours:
        # Still ongoing only if no later production hour broke it.
        ongoing = rows[last_eval_index] is current[-1]
    close()
    return runs, ongoing


def _summarise(run: _Run) -> tuple[float, float, float]:
    exp = sum(r.expected_kw or 0.0 for r in run.hours)
    act = sum(r.actual_kw or 0.0 for r in run.hours)
    deviation = (exp - act) / exp * 100 if exp > 0 else 0.0
    return deviation, exp - act, exp


def detect_site(
    session: Session, site: Site, cfg: DetectionConfig | None = None, now: datetime | None = None
) -> list[Alert]:
    """Create or update alerts for a site. Idempotent: keyed by (site, kind, window_from)."""
    cfg = cfg or DetectionConfig()
    now = now or utcnow()
    rows = list(
        session.scalars(select(Telemetry).where(Telemetry.site_id == site.id).order_by(Telemetry.ts))
    )
    if not rows:
        return []

    touched: list[Alert] = []

    # 1) Underperformance runs
    runs, ongoing = find_underperformance_runs(rows, site.capacity_kwp, cfg)
    for idx, run in enumerate(runs):
        deviation, gap_kwh, exp_kwh = _summarise(run)
        is_last_ongoing = ongoing and idx == len(runs) - 1
        severity = "critical" if deviation >= cfg.critical_deviation_pct else "warning"
        evidence = [
            f"Output {deviation:.1f}% below expected over {len(run.hours)} consecutive production hours",
            f"Estimated shortfall {gap_kwh:.0f} kWh of {exp_kwh:.0f} kWh expected "
            f"(estimate from the {run.hours[0].expected_source or 'unknown'} baseline, not a measured loss)",
            f"Hours with missing data inside the window: 0 (a missing production hour ends a run)",
        ]
        alert = session.scalar(
            select(Alert).where(
                Alert.site_id == site.id, Alert.kind == "underperformance", Alert.window_from == run.start
            )
        )
        if alert is None:
            alert = Alert(
                site_id=site.id,
                kind="underperformance",
                detected_at=run.hours[cfg.min_persistence_hours - 1].ts + HOUR,
                window_from=run.start,
                detector=DETECTOR,
            )
            session.add(alert)
        alert.title = "Sustained output below expected"
        alert.severity = severity
        alert.window_to = run.end
        alert.persistence_hours = len(run.hours)
        alert.deviation_pct = round(deviation, 2)
        alert.est_gap_kwh = round(gap_kwh, 2)
        alert.evidence = evidence
        if is_last_ongoing:
            alert.status = "open"
        elif alert.case is None:
            alert.status = "closed"  # output recovered by itself and nobody opened a case
        touched.append(alert)

    # 2) Trailing no-data
    trailing: list[Telemetry] = []
    for row in reversed(rows):
        if row.actual_kw is None:
            trailing.append(row)
        else:
            break
    trailing.reverse()
    if len(trailing) >= cfg.no_data_hours:
        start = trailing[0].ts
        alert = session.scalar(
            select(Alert).where(Alert.site_id == site.id, Alert.kind == "no_data", Alert.window_from == start)
        )
        if alert is None:
            alert = Alert(
                site_id=site.id,
                kind="no_data",
                detected_at=trailing[cfg.no_data_hours - 1].ts + HOUR,
                window_from=start,
                detector=DETECTOR,
            )
            session.add(alert)
        alert.title = "Site stopped reporting"
        alert.severity = "warning"
        alert.status = "open"
        alert.window_to = trailing[-1].ts + HOUR
        alert.persistence_hours = len(trailing)
        alert.deviation_pct = None
        alert.est_gap_kwh = None
        alert.evidence = [
            f"No telemetry for the last {len(trailing)} hour(s) of the uploaded series",
            "Energy gap cannot be estimated without data; generation itself may be unaffected",
        ]
        touched.append(alert)

    session.flush()
    return touched
