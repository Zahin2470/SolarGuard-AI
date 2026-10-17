from __future__ import annotations

import pytest

from .conftest import upload
from .factories import START, build_csv


@pytest.fixture()
def case_id(client, site):
    csv = build_csv(3, factor=lambda ts: 0.7 if ts.day == 2 else 1.0)
    alert = upload(client, site, csv).json()["alerts"][0]
    r = client.post(f"/alerts/{alert['id']}/case")
    assert r.status_code == 201
    return r.json()["id"]


def go(client, cid, to, **kw):
    return client.post(f"/cases/{cid}/transition", json={"to": to, **kw})


def test_new_case_copies_estimates_and_starts_unverified(client, case_id):
    c = client.get(f"/cases/{case_id}").json()
    assert c["status"] == "needs_review"
    assert c["est_gap_kwh"] > 0
    assert c["recoverable_kwh"] is None and c["labels"]["recoverable_kwh"] == "not_estimated"
    assert c["verification_status"] == "not_yet_verified"
    assert [e["kind"] for e in c["events"]] == ["created"]


def test_one_case_per_alert(client, site):
    alert = upload(client, site, build_csv(2, factor=lambda ts: 0.7 if ts.day == 2 else 1.0)).json()["alerts"][0]
    assert client.post(f"/alerts/{alert['id']}/case").status_code == 201
    assert client.post(f"/alerts/{alert['id']}/case").status_code == 409
    assert client.get(f"/alerts/{alert['id']}").json()["case_id"] is not None


def test_full_happy_path_with_audit_trail(client, case_id):
    assert go(client, case_id, "confirmed", note="Clear string pattern").status_code == 200
    r = go(client, case_id, "action_assigned", owner="O&M crew B")
    assert r.json()["owner"] == "O&M crew B"
    assert go(client, case_id, "in_progress").json()["action_started_at"] is not None
    r = go(client, case_id, "resolved", action_taken="Replaced blown string fuse")
    body = r.json()
    assert body["status"] == "resolved"
    assert body["action_taken"] == "Replaced blown string fuse"
    assert body["labels"]["action_taken"] == "recorded"
    assert body["verification_status"] == "not_yet_verified"  # an action is not an outcome
    assert [e["to_status"] for e in body["events"] if e["kind"] == "transition"] == [
        "confirmed", "action_assigned", "in_progress", "resolved",
    ]


@pytest.mark.parametrize(
    "start,to",
    [("needs_review", "resolved"), ("needs_review", "in_progress"), ("needs_review", "action_assigned")],
)
def test_invalid_transitions_are_409(client, case_id, start, to):
    assert go(client, case_id, to, owner="x", action_taken="x").status_code == 409


def test_required_fields_are_enforced(client, case_id):
    assert go(client, case_id, "rejected").status_code == 422                 # needs a reason
    go(client, case_id, "confirmed")
    assert go(client, case_id, "action_assigned").status_code == 422          # needs an owner
    go(client, case_id, "action_assigned", owner="crew")
    go(client, case_id, "in_progress")
    assert go(client, case_id, "resolved").status_code == 422                 # needs action_taken


def test_rejection_records_reason_and_is_terminal(client, case_id):
    r = go(client, case_id, "rejected", note="Sensor drift, not a fault")
    assert r.json()["rejection_reason"] == "Sensor drift, not a fault"
    assert go(client, case_id, "confirmed").status_code == 409


def test_inconclusive_can_be_revisited(client, case_id):
    assert go(client, case_id, "inconclusive", note="Need more data").status_code == 200
    assert go(client, case_id, "confirmed").status_code == 200


def test_recoverable_estimate_needs_rationale_and_is_labelled_potential(client, case_id):
    bad = client.patch(f"/cases/{case_id}", json={"set_recoverable": True, "recoverable_fraction": 0.8})
    assert bad.status_code == 422
    out_of_range = client.patch(
        f"/cases/{case_id}",
        json={"set_recoverable": True, "recoverable_fraction": 1.4, "recoverable_rationale": "x"},
    )
    assert out_of_range.status_code == 422
    ok = client.patch(
        f"/cases/{case_id}",
        json={"set_recoverable": True, "recoverable_fraction": 0.8, "recoverable_rationale": "One string out of five",
              "probable_cause": "Blown string fuse (hypothesis)"},
    ).json()
    assert ok["recoverable_kwh"] == pytest.approx(ok["est_gap_kwh"] * 0.8, rel=1e-3)
    assert ok["labels"]["recoverable_kwh"] == "potential"
    assert ok["probable_cause"].startswith("Blown")


def test_priority_sort_ranks_severity_then_gap(client, site):
    csv = build_csv(8, factor=lambda ts: 0.5 if ts.day == 2 else (0.85 if ts.day in (5, 6) else 1.0))
    alerts = upload(client, site, csv).json()["alerts"]
    for a in alerts:
        client.post(f"/alerts/{a['id']}/case")
    ranked = client.get("/cases", params={"sort": "priority"}).json()
    assert ranked[0]["severity"] == "critical" and ranked[-1]["severity"] == "warning"
    assert "severity" in ranked[0]["rank_reason"]


def test_bad_ids_are_404(client):
    assert client.get("/cases/RC-9999").status_code == 404
    assert client.get("/cases/nonsense").status_code == 404
    assert client.get("/alerts/AL-9999").status_code == 404
