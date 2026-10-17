"""Application factory. `uvicorn app.main:app` for local runs; tests call create_app(settings)."""
from __future__ import annotations

import hmac

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import router
from .config import Settings
from .db import Base, make_engine, make_session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)  # MVP: no migrations yet (see README)

    app = FastAPI(
        title="SolarGuard AI API",
        version="0.1.0",
        description="Telemetry ingestion, rule-based detection, recovery cases and outcome verification.",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def api_key_guard(request: Request, call_next):
        key = settings.api_key
        open_paths = {"/health", "/docs", "/openapi.json", "/redoc"}
        if key and request.method != "OPTIONS" and request.url.path not in open_paths:
            supplied = request.headers.get("x-api-key", "")
            if not hmac.compare_digest(supplied.encode(), key.encode()):
                return JSONResponse({"detail": "missing or invalid X-API-Key"}, status_code=401)
        return await call_next(request)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "auth_required": settings.api_key is not None}

    app.include_router(router)
    return app


app = create_app()
