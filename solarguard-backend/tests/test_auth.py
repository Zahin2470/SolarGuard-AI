from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_api_key_is_enforced_when_configured():
    app = create_app(Settings(database_url="sqlite://", api_key="s3cret"))
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        assert c.get("/sites").status_code == 401
        assert c.get("/sites", headers={"X-API-Key": "wrong"}).status_code == 401
        assert c.get("/sites", headers={"X-API-Key": "s3cret"}).status_code == 200


def test_no_key_configured_means_open_access_and_health_says_so():
    app = create_app(Settings(database_url="sqlite://", api_key=None))
    with TestClient(app) as c:
        assert c.get("/health").json()["auth_required"] is False
        assert c.get("/sites").status_code == 200
