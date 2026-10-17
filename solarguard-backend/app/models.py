"""Lean MVP schema: just what is needed for traceable action and outcome verification."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    capacity_kwp: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class Telemetry(Base):
    """One HOURLY interval. ts is the interval START in UTC. null power = no data (NOT zero)."""

    __tablename__ = "telemetry"
    __table_args__ = (
        UniqueConstraint("site_id", "ts", name="uq_telemetry_site_ts"),
        Index("ix_telemetry_site_ts", "site_id", "ts"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(UTCDateTime)
    actual_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    # "provided" (from the CSV) or "trailing_median" (derived from the site's own history).
    expected_source: Mapped[str | None] = mapped_column(String(32), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("site_id", "kind", "window_from", name="uq_alert_window"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(32))  # underperformance | no_data
    severity: Mapped[str] = mapped_column(String(16))  # info | warning | critical
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | closed
    detected_at: Mapped[datetime] = mapped_column(UTCDateTime)
    window_from: Mapped[datetime] = mapped_column(UTCDateTime)
    window_to: Mapped[datetime] = mapped_column(UTCDateTime)
    persistence_hours: Mapped[int] = mapped_column(Integer)
    deviation_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Estimated shortfall over valid production hours in the window (kWh). Not a measured saving.
    est_gap_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    detector: Mapped[str] = mapped_column(String(64), default="rule_v1")

    case: Mapped["RecoveryCase | None"] = relationship(back_populates="alert", uselist=False)


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), unique=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    severity: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(24), default="needs_review")
    probable_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    est_gap_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Explicit human assumption. Null until a person sets it, together with a rationale.
    recoverable_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    recoverable_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    action_completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # not_yet_verified | verified | inconclusive | not_verifiable
    verification_status: Mapped[str] = mapped_column(String(24), default="not_yet_verified")
    verification_level: Mapped[str | None] = mapped_column(String(24), nullable=True)
    verification_detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)

    alert: Mapped[Alert] = relationship(back_populates="case")
    events: Mapped[list["CaseEvent"]] = relationship(
        back_populates="case", order_by="CaseEvent.id", cascade="all, delete-orphan"
    )


class CaseEvent(Base):
    """Append-only audit trail for a recovery case."""

    __tablename__ = "case_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("recovery_cases.id", ondelete="CASCADE"))
    at: Mapped[datetime] = mapped_column(UTCDateTime)
    kind: Mapped[str] = mapped_column(String(24))  # created | transition | edited | verification
    from_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    actor: Mapped[str] = mapped_column(String(200), default="api")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    case: Mapped[RecoveryCase] = relationship(back_populates="events")
