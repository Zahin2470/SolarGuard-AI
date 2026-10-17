from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

from .factories import CAPACITY


@pytest.fixture()
def client() -> TestClient:
    app = create_app(Settings(database_url="sqlite://", api_key=None))
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def site(client: TestClient) -> str:
    r = client.post("/sites", json={"id": "S1", "name": "Test Site", "capacity_kwp": CAPACITY})
    assert r.status_code == 201, r.text
    return "S1"


def upload(client: TestClient, site_id: str, csv_text: str, tz: str = "UTC"):
    return client.post(
        f"/sites/{site_id}/telemetry",
        files={"file": ("t.csv", csv_text.encode(), "text/csv")},
        data={"timezone": tz},
    )
