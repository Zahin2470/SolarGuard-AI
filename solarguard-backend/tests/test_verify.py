from __future__ import annotations

from datetime import timedelta

import pytest

from .conftest import upload
from .factories import START, build_csv

FIX_FROM = 8     # day index fault starts
FIX_AT = 15      # day index the action is completed (noon)


def _fault(ts):
    """Faulty from day 8 until the action is completed at noon on day 15."""
    return 0.7 if START + timedelta(days=FIX_FROM) <= ts < START + timedelta(days=FIX_AT, hours=12) else 1.0


def _resolved_case(client, site, with_expected: bool, days: int = 24):
    csv = build_csv(days, factor=_fault, with_expected=with_expected)
    alerts = upload(client, site, csv).json()["alerts"]
    alert = next(a for a in alerts if a["kind"] == "underperformance")
    cid = client.post(f"/alerts/{alert['id']}/case").json()["id"]
    client.post(f"/cases/{cid}/transition", json={"to": "confirmed"})
    client.post(f"/cases/{cid}/transition", json={"to": "action_assigned", "owner": "crew"})
    start = START + timedelta(days=FIX_AT, hours=9)
    done = START + timedelta(days=FIX_AT, hours=12)
    client.post(f"/cases/{cid}/transition", json={"to": "in_progress", "action_started_at": start.isoformat()})
    r = client.post(
        f"/cases/{cid}/transition",
        json={"to": "resolved", "action_taken": "Replaced fuse", "action_completed_at": done.isoformat()},
    )
    assert r.status_code == 200, r.text
    return cid


def test_verified_only_with_independent_baseline_and_real_improvement(client, site):
    cid = _resolved_case(client, site, with_expected=True)
    c = client.post(f"/cases/{cid}/verify").json()
    assert c["verification_status"] == "verified"
    assert c["verification_level"] == "verified"
    d = c["verification_detail"]
    assert d["baseline_independent"] is True
    assert d["delta_performance_ratio_pts"] == pytest.approx(30.0, abs=0.5)
    assert d["measured_incremental_kwh_post_window"] > 0
    assert any("not proof of cause" in x for x in d["limitations"])
    assert c["events"][-1]["kind"] == "verification"


def test_derived_baseline_can_never_verify(client, site):
    cid = _resolved_case(client, site, with_expected=False)
    c = client.post(f"/cases/{cid}/verify").json()
    assert c["verification_status"] != "verified"
    assert c["verification_level"] in ("measured", "not_verifiable")
    if c["verification_level"] == "measured":
        assert "independent" in c["verification_detail"]["summary"]


def test_no_post_action_data_is_not_verifiable_not_a_made_up_result(client, site):
    # Series ends the moment the action is completed: nothing to compare against.
    cid = _resolved_case(client, site, with_expected=True, days=FIX_AT)
    c = client.post(f"/cases/{cid}/verify").json()
    assert c["verification_status"] == "not_verifiable"
    assert "Not enough valid production hours" in c["verification_detail"]["summary"]


def test_no_improvement_is_inconclusive(client, site):
    csv = build_csv(24, factor=lambda ts: 0.7 if (ts - START).days >= FIX_FROM else 1.0)  # never fixed
    alerts = upload(client, site, csv).json()["alerts"]
    cid = client.post(f"/alerts/{alerts[0]['id']}/case").json()["id"]
    for body in (
        {"to": "confirmed"},
        {"to": "action_assigned", "owner": "crew"},
        {"to": "in_progress", "action_started_at": (START + timedelta(days=15, hours=9)).isoformat()},
        {"to": "resolved", "action_taken": "Cleaned modules", "action_completed_at": (START + timedelta(days=15, hours=12)).isoformat()},
    ):
        assert client.post(f"/cases/{cid}/transition", json=body).status_code == 200
    c = client.post(f"/cases/{cid}/verify").json()
    assert c["verification_status"] == "inconclusive"
    assert c["verification_level"] == "measured"


def test_unresolved_case_cannot_be_verified(client, site):
    alert = upload(client, site, build_csv(3, factor=lambda ts: 0.7 if ts.day == 2 else 1.0)).json()["alerts"][0]
    cid = client.post(f"/alerts/{alert['id']}/case").json()["id"]
    assert client.post(f"/cases/{cid}/verify").status_code == 409
