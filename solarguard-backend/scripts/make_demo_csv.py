"""Writes two deterministic DEMO telemetry CSVs (synthetic, not customer data).

  demo_with_expected.csv     has an independent expected_kw column -> verification can reach "verified"
  demo_without_expected.csv  no expected_kw -> a trailing-median baseline is derived (never verifiable)

Story in both: a 420 kWp site, 24 days of hourly data from 2026-09-01 (UTC), a string fault from
day 8 (output x0.81) that is fixed at 12:00 on day 15.
"""
from __future__ import annotations

import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

CAPACITY = 420.0
START = datetime(2026, 9, 1, tzinfo=timezone.utc)
FAULT_FROM = START + timedelta(days=8)
FIXED_AT = START + timedelta(days=15, hours=12)


def expected(ts: datetime) -> float:
    if ts.hour < 6 or ts.hour >= 18:
        return 0.0
    cloud = 0.93 + 0.07 * math.sin(ts.day * 1.7)  # deterministic day-to-day weather variation
    return CAPACITY * 0.82 * math.sin(math.pi * (ts.hour - 6 + 0.5) / 12) * cloud


def write(path: Path, with_expected: bool) -> None:
    rows = ["timestamp,power_kw" + (",expected_kw" if with_expected else "")]
    for h in range(24 * 24):
        ts = START + timedelta(hours=h)
        exp = expected(ts)
        factor = 0.81 if FAULT_FROM <= ts < FIXED_AT else 0.995
        row = f"{ts.isoformat()},{exp * factor:.2f}"
        if with_expected:
            row += f",{exp:.2f}"
        rows.append(row)
    path.write_text("\n".join(rows) + "\n")


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out.mkdir(parents=True, exist_ok=True)
    write(out / "demo_with_expected.csv", True)
    write(out / "demo_without_expected.csv", False)
    print("wrote", out / "demo_with_expected.csv", "and", out / "demo_without_expected.csv")
