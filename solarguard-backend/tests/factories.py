"""Synthetic telemetry builders. Deterministic: no randomness."""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

CAPACITY = 100.0
START = datetime(2026, 9, 1, 0, 0, tzinfo=timezone.utc)


def expected_kw(hour_of_day: int) -> float:
    """Bell curve between 06:00 and 18:00 UTC peaking near 82 kW for a 100 kWp site."""
    if hour_of_day < 6 or hour_of_day >= 18:
        return 0.0
    return round(82 * math.sin(math.pi * (hour_of_day - 6 + 0.5) / 12), 3)


def build_csv(
    days: int,
    factor=lambda ts: 1.0,
    with_expected: bool = True,
    blank=lambda ts: False,
    start: datetime = START,
) -> str:
    """factor(ts) scales actual vs expected; blank(ts) leaves power_kw empty (no data)."""
    lines = ["timestamp,power_kw" + (",expected_kw" if with_expected else "")]
    for h in range(days * 24):
        ts = start + timedelta(hours=h)
        exp = expected_kw(ts.hour)
        actual = "" if blank(ts) else f"{exp * factor(ts):.3f}"
        row = f"{ts.isoformat()},{actual}"
        if with_expected:
            row += f",{exp:.3f}"
        lines.append(row)
    return "\n".join(lines) + "\n"
