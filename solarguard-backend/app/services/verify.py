"""Pre/post outcome verification for a resolved recovery case.

Method: compare the performance ratio PR = sum(actual) / sum(expected) over valid PRODUCTION hours
in a pre-action window and a post-action window. Because expected power tracks the weather when it
is independent, PR is a weather-normalised comparison; raw energy before/after is NOT used.

Evidence levels returned in `level` (master prompt section 35.4):
  not_verifiable  data in one window is insufficient: no conclusion possible
  measured        PR changed (or did not) but the comparison cannot support a verified claim
  verified        PR improved by >= min_improvement_pts AND the baseline is independent of the site's
                  own post-fault history (expected_kw was provided in the upload)

"verified" never means "proven causal". Curtailment, soiling by rain, sensor changes and other
confounders are not observable here and are listed in `limitations`.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import VerifyConfig
from ..db import utcnow
from ..models import RecoveryCase, Site, Telemetry
from .cases import CaseError, _event

LIMITATIONS = [
    "A before/after change is not proof of cause; unobserved confounders may explain it.",
    "Curtailment, export limits, sensor changes and maintenance by others are not visible in this data.",
    "Performance ratio compares output to the expected-power input; errors in that input carry through.",
]


class NotResolved(CaseError):
    status_code = 409


def _window_stats(
    rows: list[Telemetry], capacity_kwp: float, prod_min_fraction: float
) -> dict:
    valid = [
        r
        for r in rows
        if r.expected_kw is not None
        and r.expected_kw >= prod_min_fraction * capacity_kwp
        and r.actual_kw is not None
    ]
    act = sum(r.actual_kw for r in valid)  # type: ignore[misc]
    exp = sum(r.expected_kw for r in valid)  # type: ignore[misc]
    return {
        "valid_production_hours": len(valid),
        "actual_kwh": round(act, 2),
        "expected_kwh": round(exp, 2),
        "performance_ratio": round(act / exp, 4) if exp > 0 else None,
        "baseline_sources": sorted({r.expected_source for r in valid if r.expected_source}),
    }


def verify_case(
    session: Session,
    case: RecoveryCase,
    site: Site,
    cfg: VerifyConfig | None = None,
    prod_min_fraction: float = 0.05,
    actor: str = "api",
) -> RecoveryCase:
    cfg = cfg or VerifyConfig()
    if case.status != "resolved" or case.action_completed_at is None:
        raise NotResolved("verification needs a resolved case with a recorded action_completed_at")

    started = case.action_started_at or case.action_completed_at
    completed = case.action_completed_at
    pre_from, pre_to = started - timedelta(days=cfg.pre_days), started
    post_from, post_to = completed, completed + timedelta(days=cfg.post_days)

    def load(a: datetime, b: datetime) -> list[Telemetry]:
        return list(
            session.scalars(
                select(Telemetry)
                .where(Telemetry.site_id == site.id, Telemetry.ts >= a, Telemetry.ts < b)
                .order_by(Telemetry.ts)
            )
        )

    pre = _window_stats(load(pre_from, pre_to), site.capacity_kwp, prod_min_fraction)
    post = _window_stats(load(post_from, post_to), site.capacity_kwp, prod_min_fraction)

    detail: dict = {
        "method": "performance_ratio_pre_post",
        "pre_window": {"from": pre_from.isoformat(), "to": pre_to.isoformat(), **pre},
        "post_window": {"from": post_from.isoformat(), "to": post_to.isoformat(), **post},
        "config": {
            "min_valid_production_hours": cfg.min_valid_production_hours,
            "min_improvement_pts": cfg.min_improvement_pts,
        },
        "limitations": list(LIMITATIONS),
        "computed_at": utcnow().isoformat(),
    }

    enough = (
        pre["valid_production_hours"] >= cfg.min_valid_production_hours
        and post["valid_production_hours"] >= cfg.min_valid_production_hours
    )
    if not enough:
        status, level = "not_verifiable", "not_verifiable"
        note = (
            f"Not enough valid production hours (pre {pre['valid_production_hours']}, "
            f"post {post['valid_production_hours']}; need {cfg.min_valid_production_hours} in each window)."
        )
    else:
        delta_pts = round((post["performance_ratio"] - pre["performance_ratio"]) * 100, 2)
        incremental = round((post["performance_ratio"] - pre["performance_ratio"]) * post["expected_kwh"], 2)
        independent = pre["baseline_sources"] == ["provided"] and post["baseline_sources"] == ["provided"]
        detail.update(
            {
                "delta_performance_ratio_pts": delta_pts,
                "measured_incremental_kwh_post_window": incremental,
                "baseline_independent": independent,
            }
        )
        if delta_pts < cfg.min_improvement_pts:
            status, level = "inconclusive", "measured"
            note = (
                f"Performance ratio changed by {delta_pts:+.1f} points, below the "
                f"{cfg.min_improvement_pts:g}-point threshold for a measurable improvement."
            )
        elif not independent:
            status, level = "inconclusive", "measured"
            note = (
                f"Performance ratio rose {delta_pts:+.1f} points, but the expected-power baseline is derived "
                "from the site's own history and can absorb the fault. Upload an independent expected_kw "
                "(weather-driven model) to allow verification."
            )
        else:
            status, level = "verified", "verified"
            note = (
                f"Performance ratio rose {delta_pts:+.1f} points against an independent baseline "
                f"(measured incremental energy {incremental:.0f} kWh over the post window). "
                "Association supported; causation not claimed."
            )
    detail["summary"] = note

    case.verification_status = status
    case.verification_level = level
    case.verification_detail = detail
    case.updated_at = utcnow()
    _event(session, case, "verification", actor, note=f"{status}: {note}")
    session.flush()
    return case
