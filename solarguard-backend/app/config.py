"""Runtime settings and the documented default thresholds for detection and verification.

Thresholds are DEFAULTS chosen to be easy to explain, not validated values. They are
overridable per request and must be calibrated against real operator-confirmed outcomes.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./solarguard.db")
    )
    # When set, every request except /health must send header X-API-Key with this value.
    api_key: str | None = field(default_factory=lambda: os.getenv("SOLARGUARD_API_KEY") or None)
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
            if o.strip()
        )
    )
    max_upload_bytes: int = 20 * 1024 * 1024


@dataclass(frozen=True)
class DetectionConfig:
    # An hour counts as a "production hour" when expected power >= this share of nameplate.
    production_min_fraction: float = 0.05
    # An hour is "below expected" when (expected - actual) / expected >= this percentage.
    deviation_threshold_pct: float = 10.0
    # Consecutive production hours below expected before an alert is raised.
    min_persistence_hours: int = 4
    # Mean deviation at or above this makes the alert CRITICAL, otherwise WARNING.
    critical_deviation_pct: float = 20.0
    # Trailing hours without data before a "no data" alert is raised.
    no_data_hours: int = 3


@dataclass(frozen=True)
class VerifyConfig:
    pre_days: int = 7
    post_days: int = 7
    # Minimum valid production hours required in EACH window.
    min_valid_production_hours: int = 12
    # Minimum improvement in performance ratio (percentage points) to call a change measurable.
    min_improvement_pts: float = 3.0
