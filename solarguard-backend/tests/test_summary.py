from datetime import datetime, timedelta, timezone

from .conftest import upload
from .factories import START, build_csv


def test_summary_lists_sites_without_data_as_empty(client, site):
    r = client.get("/sites/summary")
    assert r.status_code == 200
    row = r.json()[0]
    assert row["site_id"] == site
    assert row["hours_stored"] == 0
    assert row["last_hour"] is None and row["last_hour_with_data"] is None
    assert row["expected_sources"] == []


def test_summary_reports_extent_last_data_hour_and_source(client, site):
    last_blank = START + timedelta(days=3) - timedelta(hours=3)  # final 3 hours have no data
    csv = build_csv(3, blank=lambda ts: ts >= last_blank)
    assert upload(client, site, csv).status_code == 200
    row = client.get("/sites/summary").json()[0]
    assert row["hours_stored"] == 72
    assert datetime.fromisoformat(row["first_hour"].replace("Z", "+00:00")) == START
    assert datetime.fromisoformat(row["last_hour"].replace("Z", "+00:00")) == START + timedelta(hours=71)
    # last hour carrying data is the hour before the blank run, and it is timezone-aware UTC
    last_data = datetime.fromisoformat(row["last_hour_with_data"].replace("Z", "+00:00"))
    assert last_data == last_blank - timedelta(hours=1)
    assert last_data.tzinfo == timezone.utc
    assert row["expected_sources"] == ["provided"]


def test_summary_route_is_not_shadowed_by_site_id(client, site):
    assert client.get("/sites/summary").status_code == 200
    assert client.get("/sites/NOPE").status_code == 404
