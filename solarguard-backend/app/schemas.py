"""API contracts. Display IDs (AL-0001, RC-0001) are derived from integer primary keys."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .models import Alert, CaseEvent, RecoveryCase, Site
from .services.cases import recoverable_kwh

CaseStatus = Literal[
    "needs_review", "confirmed", "rejected", "inconclusive", "action_assigned", "in_progress", "resolved"
]


class SiteIn(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    name: str = Field(min_length=1, max_length=200)
    location: str | None = None
    capacity_kwp: float = Field(gt=0, le=1_000_000)


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    location: str | None
    capacity_kwp: float
    created_at: datetime


class SiteDataSummaryOut(BaseModel):
    """What telemetry a site has, so clients can pick a window without paging through rows."""

    site_id: str
    hours_stored: int
    first_hour: datetime | None
    last_hour: datetime | None
    last_hour_with_data: datetime | None  # latest hour whose actual power is not null
    expected_sources: list[str]  # e.g. ["provided"], ["trailing_median"], or both


class TelemetryOut(BaseModel):
    ts: datetime
    actual_kw: float | None
    expected_kw: float | None
    expected_source: str | None


class RejectedRow(BaseModel):
    line: int
    reason: str


class IngestReportOut(BaseModel):
    rows_received: int
    rows_rejected: int
    rejected_samples: list[RejectedRow]
    duplicates_dropped: int
    interval_minutes: int
    hours_stored: int
    hours_with_actual: int
    hours_without_actual: int
    first_hour: datetime | None
    last_hour: datetime | None
    expected_source: str
    warnings: list[str]


class AlertOut(BaseModel):
    id: str
    site_id: str
    kind: str
    severity: str
    title: str
    status: str
    detected_at: datetime
    window_from: datetime
    window_to: datetime
    persistence_hours: int
    deviation_pct: float | None
    est_gap_kwh: float | None
    evidence: list[str]
    detector: str
    case_id: str | None
    # Evidence-level labels so clients never present these as measured savings.
    labels: dict[str, str]

    @classmethod
    def of(cls, a: Alert) -> "AlertOut":
        return cls(
            id=f"AL-{a.id:04d}",
            site_id=a.site_id,
            kind=a.kind,
            severity=a.severity,
            title=a.title,
            status=a.status,
            detected_at=a.detected_at,
            window_from=a.window_from,
            window_to=a.window_to,
            persistence_hours=a.persistence_hours,
            deviation_pct=a.deviation_pct,
            est_gap_kwh=a.est_gap_kwh,
            evidence=list(a.evidence or []),
            detector=a.detector,
            case_id=f"RC-{a.case.id:04d}" if a.case else None,
            labels={"deviation": "detected", "est_gap_kwh": "estimated"},
        )


class DetectionResult(BaseModel):
    alerts: list[AlertOut]


class UploadResult(BaseModel):
    ingest: IngestReportOut
    alerts: list[AlertOut]


class CaseEventOut(BaseModel):
    at: datetime
    kind: str
    from_status: str | None
    to_status: str | None
    actor: str
    note: str | None

    @classmethod
    def of(cls, e: CaseEvent) -> "CaseEventOut":
        return cls(
            at=e.at, kind=e.kind, from_status=e.from_status, to_status=e.to_status, actor=e.actor, note=e.note
        )


class CaseOut(BaseModel):
    id: str
    alert_id: str
    site_id: str
    title: str
    severity: str
    status: str
    probable_cause: str | None
    est_gap_kwh: float | None
    recoverable_fraction: float | None
    recoverable_kwh: float | None
    recoverable_rationale: str | None
    owner: str | None
    rejection_reason: str | None
    action_taken: str | None
    action_started_at: datetime | None
    action_completed_at: datetime | None
    verification_status: str
    verification_level: str | None
    verification_detail: dict | None
    created_at: datetime
    updated_at: datetime
    rank_reason: str | None = None
    labels: dict[str, str]
    events: list[CaseEventOut] | None = None

    @classmethod
    def of(cls, c: RecoveryCase, with_events: bool = False, rank_reason: str | None = None) -> "CaseOut":
        rec = recoverable_kwh(c)
        return cls(
            id=f"RC-{c.id:04d}",
            alert_id=f"AL-{c.alert_id:04d}",
            site_id=c.site_id,
            title=c.title,
            severity=c.severity,
            status=c.status,
            probable_cause=c.probable_cause,
            est_gap_kwh=c.est_gap_kwh,
            recoverable_fraction=c.recoverable_fraction,
            recoverable_kwh=rec,
            recoverable_rationale=c.recoverable_rationale,
            owner=c.owner,
            rejection_reason=c.rejection_reason,
            action_taken=c.action_taken,
            action_started_at=c.action_started_at,
            action_completed_at=c.action_completed_at,
            verification_status=c.verification_status,
            verification_level=c.verification_level,
            verification_detail=c.verification_detail,
            created_at=c.created_at,
            updated_at=c.updated_at,
            rank_reason=rank_reason,
            labels={
                "est_gap_kwh": "estimated",
                "recoverable_kwh": "potential" if rec is not None else "not_estimated",
                "action_taken": "recorded" if c.action_taken else "none",
                "verification": c.verification_level or "not_yet_verified",
            },
            events=[CaseEventOut.of(e) for e in c.events] if with_events else None,
        )


class TransitionIn(BaseModel):
    to: CaseStatus
    actor: str = "api"
    note: str | None = None
    owner: str | None = None
    action_taken: str | None = None
    action_started_at: datetime | None = None
    action_completed_at: datetime | None = None


class CaseEditIn(BaseModel):
    actor: str = "api"
    probable_cause: str | None = None
    # Provide both to set; send recoverable_fraction=null with set_recoverable=true to clear.
    set_recoverable: bool = False
    recoverable_fraction: float | None = None
    recoverable_rationale: str | None = None


class CaseCreateIn(BaseModel):
    actor: str = "api"


class VerifyIn(BaseModel):
    actor: str = "api"
    pre_days: int = Field(default=7, ge=1, le=60)
    post_days: int = Field(default=7, ge=1, le=60)
    min_valid_production_hours: int = Field(default=12, ge=1, le=500)
    min_improvement_pts: float = Field(default=3.0, ge=0, le=100)
