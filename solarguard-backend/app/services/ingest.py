"""CSV ingestion: validate, normalise to HOURLY mean power, store, and derive a baseline if needed.

CSV columns (header names are case-insensitive):
  timestamp   required, ISO 8601. Naive timestamps are interpreted in the `timezone` form field.
  power_kw    required, AC power in kW. Blank / nan / null means "no data" (kept as a gap, not zero).
  expected_kw optional, independent expected power in kW (e.g. from a weather-driven model).
              When absent, a trailing same-hour median baseline is derived from the site's own
              history. That baseline is NOT independent of the fault being detected (see verify.py).
"""
from __future__ import annotations

import csv
import io
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Site, Telemetry

HOUR = timedelta(hours=1)
SUPPORTED_INTERVALS_MIN = (1, 5, 10, 15, 20, 30, 60)
MIN_HOUR_COVERAGE = 0.75  # share of an hour's samples required to compute an hourly mean
MAX_REJECT_SAMPLES = 20
NO_DATA_TOKENS = {"", "nan", "null", "none", "na", "n/a"}


class IngestError(ValueError):
    """The file cannot be used at all (bad header, no usable rows, unsupported interval)."""


@dataclass
class HourPoint:
    ts: datetime  # interval start, UTC
    actual_kw: float | None
    expected_kw: float | None = None


@dataclass
class IngestReport:
    rows_received: int = 0
    rows_rejected: int = 0
    rejected_samples: list[dict] = field(default_factory=list)
    duplicates_dropped: int = 0
    interval_minutes: int = 0
    hours_stored: int = 0
    hours_with_actual: int = 0
    hours_without_actual: int = 0
    first_hour: datetime | None = None
    last_hour: datetime | None = None
    expected_source: str = "trailing_median"
    warnings: list[str] = field(default_factory=list)


def _reject(report: IngestReport, line: int, reason: str) -> None:
    report.rows_rejected += 1
    if len(report.rejected_samples) < MAX_REJECT_SAMPLES:
        report.rejected_samples.append({"line": line, "reason": reason})


def _parse_float(raw: str | None) -> tuple[float | None, bool]:
    """Returns (value, ok). Blank/nan tokens are (None, True): a valid 'no data'."""
    if raw is None:
        return None, True
    s = raw.strip().lower()
    if s in NO_DATA_TOKENS:
        return None, True
    try:
        v = float(s)
    except ValueError:
        return None, False
    if math.isnan(v) or math.isinf(v):
        return None, False
    return v, True


def _parse_ts(raw: str, tz: ZoneInfo) -> datetime:
    s = raw.strip()
    if s.endswith(("Z", "z")):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(timezone.utc)


def parse_csv(
    content: bytes, capacity_kwp: float, tz_name: str = "UTC"
) -> tuple[list[HourPoint], IngestReport, bool]:
    """Returns (hourly points covering a continuous range, report, expected_provided)."""
    report = IngestReport()
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise IngestError(f"unknown timezone '{tz_name}'") from exc

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise IngestError("file is not valid UTF-8 text") from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise IngestError("file is empty")
    headers = {h.strip().lower(): h for h in reader.fieldnames if h}
    for required in ("timestamp", "power_kw"):
        if required not in headers:
            raise IngestError(f"missing required column '{required}' (found: {sorted(headers)})")
    has_expected = "expected_kw" in headers

    max_kw = capacity_kwp * 1.5
    samples: dict[datetime, tuple[float | None, float | None]] = {}

    for row in reader:
        report.rows_received += 1
        line = reader.line_num
        try:
            ts = _parse_ts(row[headers["timestamp"]], tz)
        except (ValueError, TypeError, KeyError):
            _reject(report, line, "unparseable timestamp")
            continue
        actual, ok = _parse_float(row.get(headers["power_kw"]))
        if not ok:
            _reject(report, line, "power_kw is not a number")
            continue
        if actual is not None and actual < 0:
            _reject(report, line, "negative power_kw")
            continue
        if actual is not None and actual > max_kw:
            _reject(report, line, f"power_kw exceeds 150% of nameplate ({capacity_kwp:g} kWp)")
            continue
        expected: float | None = None
        if has_expected:
            expected, ok = _parse_float(row.get(headers["expected_kw"]))
            if not ok:
                _reject(report, line, "expected_kw is not a number")
                continue
            if expected is not None and (expected < 0 or expected > max_kw):
                _reject(report, line, "expected_kw outside 0..150% of nameplate")
                continue
        if ts in samples:
            report.duplicates_dropped += 1
            continue
        samples[ts] = (actual, expected)

    if len(samples) < 2:
        raise IngestError("fewer than 2 usable rows")

    ordered = sorted(samples)
    diffs = [(b - a).total_seconds() / 60 for a, b in zip(ordered, ordered[1:])]
    interval = int(round(statistics.median(diffs)))
    if interval not in SUPPORTED_INTERVALS_MIN:
        raise IngestError(
            f"unsupported sampling interval ~{interval} min; supported: {SUPPORTED_INTERVALS_MIN}"
        )
    if any(abs(d - interval) > 1e-6 for d in diffs):
        report.warnings.append(
            "sampling is not perfectly regular; gaps are handled by hourly coverage rules"
        )
    report.interval_minutes = interval
    per_hour = 60 // interval

    buckets: dict[datetime, list[tuple[float | None, float | None]]] = defaultdict(list)
    for ts in ordered:
        buckets[ts.replace(minute=0, second=0, microsecond=0)].append(samples[ts])

    first, last = min(buckets), max(buckets)
    points: list[HourPoint] = []
    hour = first
    while hour <= last:
        rows = buckets.get(hour, [])
        a_vals = [a for a, _ in rows if a is not None]
        e_vals = [e for _, e in rows if e is not None]
        need = max(1, math.ceil(per_hour * MIN_HOUR_COVERAGE))
        points.append(
            HourPoint(
                ts=hour,
                actual_kw=round(sum(a_vals) / len(a_vals), 3) if len(a_vals) >= need else None,
                expected_kw=(
                    round(sum(e_vals) / len(e_vals), 3) if has_expected and len(e_vals) >= need else None
                ),
            )
        )
        hour += HOUR

    report.hours_stored = len(points)
    report.hours_with_actual = sum(1 for p in points if p.actual_kw is not None)
    report.hours_without_actual = report.hours_stored - report.hours_with_actual
    report.first_hour, report.last_hour = first, last
    report.expected_source = "provided" if has_expected else "trailing_median"
    if report.hours_without_actual:
        report.warnings.append(
            f"{report.hours_without_actual} hour(s) have no usable power data; "
            "they are stored as gaps and excluded from energy totals"
        )
    return points, report, has_expected


def trailing_median_baseline(
    actual_by_hour: dict[datetime, float | None], hours: list[datetime], min_days: int = 3, max_days: int = 7
) -> dict[datetime, float | None]:
    """Expected power = median of actual power at the same hour on up to 7 earlier days.

    Needs at least `min_days` earlier non-null values; otherwise None (not evaluable).
    Limitation: if the fault is already in the history, the baseline absorbs it.
    """
    out: dict[datetime, float | None] = {}
    for h in hours:
        prior = []
        for d in range(1, max_days + 1):
            v = actual_by_hour.get(h - timedelta(days=d))
            if v is not None:
                prior.append(v)
        out[h] = round(statistics.median(prior), 3) if len(prior) >= min_days else None
    return out


def store_points(
    session: Session, site: Site, points: list[HourPoint], expected_provided: bool
) -> None:
    """Upsert hourly telemetry, then (re)derive the baseline if no expected_kw was provided."""
    existing = {
        t.ts: t
        for t in session.scalars(
            select(Telemetry).where(
                Telemetry.site_id == site.id,
                Telemetry.ts >= points[0].ts,
                Telemetry.ts <= points[-1].ts,
            )
        )
    }
    for p in points:
        row = existing.get(p.ts)
        if row is None:
            row = Telemetry(site_id=site.id, ts=p.ts)
            session.add(row)
        row.actual_kw = p.actual_kw
        if expected_provided:
            row.expected_kw = p.expected_kw
            row.expected_source = "provided" if p.expected_kw is not None else None
    session.flush()

    if not expected_provided:
        recompute_baseline(session, site.id)


def recompute_baseline(session: Session, site_id: str) -> None:
    """Recompute trailing-median expected power for every row not carrying a provided baseline."""
    rows = list(
        session.scalars(select(Telemetry).where(Telemetry.site_id == site_id).order_by(Telemetry.ts))
    )
    actual_by_hour = {r.ts: r.actual_kw for r in rows}
    targets = [r for r in rows if r.expected_source != "provided"]
    baseline = trailing_median_baseline(actual_by_hour, [r.ts for r in targets])
    for r in targets:
        r.expected_kw = baseline[r.ts]
        r.expected_source = "trailing_median" if baseline[r.ts] is not None else None
    session.flush()
