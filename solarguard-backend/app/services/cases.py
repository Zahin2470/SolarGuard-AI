"""Recovery-case lifecycle: creation from an alert, validated transitions, edits, audit trail.

States: needs_review -> confirmed | rejected | inconclusive
        inconclusive -> confirmed | rejected
        confirmed -> action_assigned | rejected
        action_assigned -> in_progress -> resolved
Verification (verified / inconclusive / not_verifiable) is a separate field set by verify.py.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import Alert, CaseEvent, RecoveryCase

TRANSITIONS: dict[str, set[str]] = {
    "needs_review": {"confirmed", "rejected", "inconclusive"},
    "inconclusive": {"confirmed", "rejected"},
    "confirmed": {"action_assigned", "rejected"},
    "action_assigned": {"in_progress"},
    "in_progress": {"resolved"},
    "resolved": set(),
    "rejected": set(),
}
TERMINAL = {"resolved", "rejected"}


class CaseError(Exception):
    """Base for case workflow errors. `status_code` maps to the HTTP response."""

    status_code = 400


class InvalidTransition(CaseError):
    status_code = 409


class MissingField(CaseError):
    status_code = 422


def _event(
    session: Session,
    case: RecoveryCase,
    kind: str,
    actor: str,
    note: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> None:
    session.add(
        CaseEvent(
            case_id=case.id,
            at=utcnow(),
            kind=kind,
            from_status=from_status,
            to_status=to_status,
            actor=actor,
            note=note,
        )
    )


def create_case(session: Session, alert: Alert, actor: str = "api") -> RecoveryCase:
    if alert.case is not None:
        raise CaseError(f"alert already has case {alert.case.id}")
    now = utcnow()
    case = RecoveryCase(
        alert_id=alert.id,
        site_id=alert.site_id,
        title=alert.title,
        severity=alert.severity,
        status="needs_review",
        est_gap_kwh=alert.est_gap_kwh,
        created_at=now,
        updated_at=now,
    )
    session.add(case)
    session.flush()
    _event(session, case, "created", actor, note=f"Opened from alert {alert.id}", to_status="needs_review")
    session.flush()
    return case


def transition(
    session: Session,
    case: RecoveryCase,
    to: str,
    actor: str = "api",
    note: str | None = None,
    owner: str | None = None,
    action_taken: str | None = None,
    action_started_at: datetime | None = None,
    action_completed_at: datetime | None = None,
) -> RecoveryCase:
    allowed = TRANSITIONS.get(case.status, set())
    if to not in TRANSITIONS:
        raise InvalidTransition(f"unknown status '{to}'")
    if to not in allowed:
        raise InvalidTransition(
            f"cannot move from '{case.status}' to '{to}'; allowed: {sorted(allowed) or 'none (terminal)'}"
        )

    now = utcnow()
    if to == "rejected":
        if not (note and note.strip()):
            raise MissingField("rejecting a case requires a note giving the reason")
        case.rejection_reason = note.strip()
    elif to == "action_assigned":
        if not (owner and owner.strip()):
            raise MissingField("assigning an action requires an owner")
        case.owner = owner.strip()
    elif to == "in_progress":
        case.action_started_at = action_started_at or now
    elif to == "resolved":
        if not (action_taken and action_taken.strip()):
            raise MissingField("resolving a case requires action_taken (what was actually done)")
        completed = action_completed_at or now
        started = case.action_started_at
        if started and completed < started:
            raise MissingField("action_completed_at cannot be before action_started_at")
        case.action_taken = action_taken.strip()
        case.action_completed_at = completed

    previous = case.status
    case.status = to
    case.updated_at = now
    _event(session, case, "transition", actor, note=note, from_status=previous, to_status=to)
    session.flush()
    return case


def edit_case(
    session: Session,
    case: RecoveryCase,
    actor: str = "api",
    probable_cause: str | None = None,
    recoverable_fraction: float | None = None,
    recoverable_rationale: str | None = None,
    set_recoverable: bool = False,
) -> RecoveryCase:
    if case.status in TERMINAL:
        raise InvalidTransition(f"case is '{case.status}' and can no longer be edited")
    changes: list[str] = []
    if probable_cause is not None:
        case.probable_cause = probable_cause.strip() or None
        changes.append("probable_cause")
    if set_recoverable:
        if recoverable_fraction is not None:
            if not 0 <= recoverable_fraction <= 1:
                raise MissingField("recoverable_fraction must be between 0 and 1")
            if not (recoverable_rationale and recoverable_rationale.strip()):
                raise MissingField("recoverable_fraction needs a recoverable_rationale (why that share)")
        case.recoverable_fraction = recoverable_fraction
        case.recoverable_rationale = (recoverable_rationale or "").strip() or None
        changes.append("recoverable_estimate")
    if not changes:
        raise MissingField("no editable field supplied")
    case.updated_at = utcnow()
    _event(session, case, "edited", actor, note="Updated: " + ", ".join(changes))
    session.flush()
    return case


def recoverable_kwh(case: RecoveryCase) -> float | None:
    """Estimated potentially recoverable energy over the alert window; None until a human sets it."""
    if case.est_gap_kwh is None or case.recoverable_fraction is None:
        return None
    return round(case.est_gap_kwh * case.recoverable_fraction, 2)


SEVERITY_TIER = {"critical": 3, "warning": 2, "info": 1}


def priority_key(case: RecoveryCase) -> tuple[int, float]:
    """Severity tier first, then larger estimated gap. No confidence term: no model supplies one yet."""
    return (SEVERITY_TIER.get(case.severity, 0), case.est_gap_kwh or -1.0)
