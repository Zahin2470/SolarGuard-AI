from __future__ import annotations

from .conftest import upload
from .factories import build_csv


def test_missing_required_column_is_rejected(client, site):
    r = upload(client, site, "time,kw\n2026-09-01T00:00:00Z,1\n")
    assert r.status_code == 422
    assert "timestamp" in r.json()["detail"]


def test_bad_rows_are_rejected_with_line_numbers_and_good_rows_kept(client, site):
    csv = (
        "timestamp,power_kw\n"
        "2026-09-01T00:00:00Z,0\n"
        "2026-09-01T01:00:00Z,-5\n"          # negative
        "not-a-time,3\n"                      # bad timestamp
        "2026-09-01T02:00:00Z,999\n"          # > 150% of 100 kWp
        "2026-09-01T03:00:00Z,abc\n"          # not a number
        "2026-09-01T04:00:00Z,10\n"
        "2026-09-01T04:00:00Z,11\n"          # duplicate timestamp
        "2026-09-01T05:00:00Z,12\n"
        + "".join(f"2026-09-01T{h:02d}:00:00Z,{h}\n" for h in range(6, 13))
    )
    body = upload(client, site, csv).json()["ingest"]
    assert body["rows_received"] == 15
    assert body["rows_rejected"] == 4
    assert body["duplicates_dropped"] == 1
    reasons = {r["line"]: r["reason"] for r in body["rejected_samples"]}
    assert "negative" in reasons[3]
    assert "timestamp" in reasons[4]
    assert "nameplate" in reasons[5]
    assert "number" in reasons[6]


def test_blank_power_is_a_gap_not_zero(client, site):
    csv = "timestamp,power_kw\n2026-09-01T00:00:00Z,5\n2026-09-01T01:00:00Z,\n2026-09-01T02:00:00Z,7\n"
    r = upload(client, site, csv)
    assert r.json()["ingest"]["hours_without_actual"] == 1
    rows = client.get(f"/sites/{site}/telemetry").json()
    assert [x["actual_kw"] for x in rows] == [5.0, None, 7.0]


def test_15_minute_data_is_resampled_with_coverage_rule(client, site):
    # Hour 0: all four samples. Hour 1: only 2 of 4 samples (50% < 75%) -> gap.
    csv = (
        "timestamp,power_kw\n"
        "2026-09-01T00:00:00Z,10\n2026-09-01T00:15:00Z,20\n2026-09-01T00:30:00Z,30\n2026-09-01T00:45:00Z,40\n"
        "2026-09-01T01:00:00Z,50\n2026-09-01T01:15:00Z,\n2026-09-01T01:30:00Z,\n2026-09-01T01:45:00Z,60\n"
        "2026-09-01T02:00:00Z,1\n2026-09-01T02:15:00Z,1\n2026-09-01T02:30:00Z,1\n2026-09-01T02:45:00Z,1\n"
    )
    ing = upload(client, site, csv).json()["ingest"]
    assert ing["interval_minutes"] == 15
    rows = client.get(f"/sites/{site}/telemetry").json()
    assert rows[0]["actual_kw"] == 25.0
    assert rows[1]["actual_kw"] is None
    assert rows[2]["actual_kw"] == 1.0


def test_naive_timestamps_use_the_timezone_field(client, site):
    csv = "timestamp,power_kw\n2026-09-01T06:00:00,10\n2026-09-01T07:00:00,20\n"
    upload(client, site, csv, tz="Asia/Dhaka")
    first = client.get(f"/sites/{site}/telemetry").json()[0]
    assert first["ts"].startswith("2026-09-01T00:00:00")  # 06:00 +06 == 00:00 UTC


def test_unknown_timezone_and_unsupported_interval(client, site):
    assert upload(client, site, "timestamp,power_kw\n2026-09-01T00:00:00,1\n2026-09-01T01:00:00,1\n", tz="Mars/Base").status_code == 422
    odd = "timestamp,power_kw\n2026-09-01T00:00:00Z,1\n2026-09-01T00:07:00Z,1\n2026-09-01T00:14:00Z,1\n"
    r = upload(client, site, odd)
    assert r.status_code == 422 and "interval" in r.json()["detail"]


def test_trailing_median_baseline_needs_three_prior_days(client, site):
    upload(client, site, build_csv(6, with_expected=False))
    rows = client.get(f"/sites/{site}/telemetry").json()
    noon = [r for r in rows if r["ts"][11:13] == "12"]
    assert [r["expected_kw"] for r in noon[:3]] == [None, None, None]  # days 0-2: not enough history
    assert noon[3]["expected_kw"] == noon[3]["actual_kw"]  # constant pattern -> median equals pattern
    assert noon[3]["expected_source"] == "trailing_median"


def test_provided_expected_is_kept_as_independent(client, site):
    upload(client, site, build_csv(2, with_expected=True))
    rows = client.get(f"/sites/{site}/telemetry").json()
    assert {r["expected_source"] for r in rows if r["expected_kw"] is not None} == {"provided"}
