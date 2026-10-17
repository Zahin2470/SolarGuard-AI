from __future__ import annotations

from datetime import datetime, timezone

from .conftest import upload
from .factories import START, build_csv


def _alerts(client, site):
    return client.get("/alerts", params={"site_id": site}).json()


def test_sustained_shortfall_creates_a_critical_alert_with_estimated_gap(client, site):
    # Days 2-3: output at 70% of expected (30% deviation) during all production hours.
    fault = lambda ts: 0.7 if 2 <= (ts - START).days <= 3 else 1.0
    body = upload(client, site, build_csv(5, factor=fault)).json()
    under = [a for a in body["alerts"] if a["kind"] == "underperformance"]
    assert len(under) == 1  # night hours do not break the run, so one alert spans both days
    a = under[0]
    assert a["severity"] == "critical"
    assert 29.5 < a["deviation_pct"] < 30.5
    assert a["persistence_hours"] >= 20
    assert a["est_gap_kwh"] > 0
    assert a["labels"] == {"deviation": "detected", "est_gap_kwh": "estimated"}
    assert a["status"] == "closed"  # output recovered on day 4 and nobody opened a case


def test_short_dip_below_persistence_threshold_raises_nothing(client, site):
    dip = lambda ts: 0.8 if ts.day == 2 and 9 <= ts.hour < 12 else 1.0  # 3 production hours at -20%
    body = upload(client, site, build_csv(3, factor=dip)).json()
    assert body["alerts"] == []


def test_moderate_shortfall_is_warning_not_critical(client, site):
    body = upload(client, site, build_csv(2, factor=lambda ts: 0.85)).json()
    assert [a["severity"] for a in body["alerts"]] == ["warning"]


def test_missing_production_hour_breaks_the_run(client, site):
    # Fault on day 1 (x0.7) but a data gap at 12:00 splits the production hours into 6 + 5.
    csv = build_csv(
        2,
        factor=lambda ts: 0.7 if ts.day == 2 else 1.0,
        blank=lambda ts: ts.day == 2 and ts.hour == 12,
    )
    alerts = upload(client, site, csv).json()["alerts"]
    under = [a for a in alerts if a["kind"] == "underperformance"]
    assert len(under) == 2


def test_ongoing_shortfall_stays_open(client, site):
    body = upload(client, site, build_csv(2, factor=lambda ts: 0.7 if ts.day == 2 else 1.0)).json()
    assert [a["status"] for a in body["alerts"]] == ["open"]


def test_reupload_is_idempotent(client, site):
    csv = build_csv(3, factor=lambda ts: 0.7 if ts.day == 2 else 1.0)
    upload(client, site, csv)
    upload(client, site, csv)
    assert len(_alerts(client, site)) == 1


def test_trailing_no_data_raises_a_no_data_alert_without_a_gap_estimate(client, site):
    last = datetime(2026, 9, 3, 0, tzinfo=timezone.utc)
    csv = build_csv(3, blank=lambda ts: ts >= last.replace(day=3, hour=0) and ts.day == 3 and ts.hour >= 20)
    alerts = upload(client, site, csv).json()["alerts"]
    nd = [a for a in alerts if a["kind"] == "no_data"]
    assert len(nd) == 1
    assert nd[0]["est_gap_kwh"] is None and nd[0]["deviation_pct"] is None


def test_derived_baseline_still_detects_a_fresh_fault(client, site):
    fault = lambda ts: 0.6 if (ts - START).days >= 5 else 1.0
    body = upload(client, site, build_csv(7, factor=fault, with_expected=False)).json()
    assert body["ingest"]["expected_source"] == "trailing_median"
    assert any(a["kind"] == "underperformance" for a in body["alerts"])
