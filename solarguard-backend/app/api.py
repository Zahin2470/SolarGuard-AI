"""REST endpoints, organised around business actions rather than model functions."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import case as sql_case, func, select
from sqlalchemy.orm import Session

from .config import DetectionConfig, VerifyConfig
from .db import get_session, utcnow
from .models import Alert, RecoveryCase, Site, Telemetry
from .schemas import (
    AlertOut,
    CaseCreateIn,
    CaseEditIn,
    CaseOut,
    DetectionResult,
    IngestReportOut,
    SiteDataSummaryOut,
    SiteIn,
    SiteOut,
    TelemetryOut,
    TransitionIn,
    UploadResult,
    VerifyIn,
)
from .services import cases as case_svc
from .services import verify as verify_svc
from .services.detect import detect_site
from .services.ingest import IngestError, parse_csv, store_points

router = APIRouter()


def _aware(ts: datetime | None) -> datetime | None:
    """Aggregate columns bypass the UTCDateTime type, so re-attach UTC to naive stored values."""
    if ts is None:
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def _site_or_404(session: Session, site_id: str) -> Site:
    site = session.get(Site, site_id)
    if site is None:
        raise HTTPException(404, f"site '{site_id}' not found")
    return site


def _numeric_id(display: str, prefix: str) -> int:
    if not display.upper().startswith(prefix + "-") or not display[len(prefix) + 1 :].isdigit():
        raise HTTPException(404, f"invalid id '{display}' (expected {prefix}-0001 style)")
    return int(display[len(prefix) + 1 :])


def _alert_or_404(session: Session, display_id: str) -> Alert:
    alert = session.get(Alert, _numeric_id(display_id, "AL"))
    if alert is None:
        raise HTTPException(404, f"alert '{display_id}' not found")
    return alert


def _case_or_404(session: Session, display_id: str) -> RecoveryCase:
    case = session.get(RecoveryCase, _numeric_id(display_id, "RC"))
    if case is None:
        raise HTTPException(404, f"case '{display_id}' not found")
    return case


# ---- Sites -----------------------------------------------------------------------------------


@router.post("/sites", response_model=SiteOut, status_code=201)
def create_site(body: SiteIn, session: Session = Depends(get_session)) -> Site:
    if session.get(Site, body.id) is not None:
        raise HTTPException(409, f"site '{body.id}' already exists")
    site = Site(**body.model_dump(), created_at=utcnow())
    session.add(site)
    session.commit()
    return site


@router.get("/sites", response_model=list[SiteOut])
def list_sites(session: Session = Depends(get_session)) -> list[Site]:
    return list(session.scalars(select(Site).order_by(Site.id)))


@router.get("/sites/summary", response_model=list[SiteDataSummaryOut])
def sites_summary(session: Session = Depends(get_session)) -> list[SiteDataSummaryOut]:
    """Per-site telemetry extent. Declared before /sites/{site_id} so 'summary' is not read as an id."""
    agg = {
        row.site_id: row
        for row in session.execute(
            select(
                Telemetry.site_id,
                func.count().label("n"),
                func.min(Telemetry.ts).label("first_ts"),
                func.max(Telemetry.ts).label("last_ts"),
                func.max(sql_case((Telemetry.actual_kw.is_not(None), Telemetry.ts))).label("last_data_ts"),
            ).group_by(Telemetry.site_id)
        )
    }
    sources: dict[str, set[str]] = {}
    for site_id, src in session.execute(
        select(Telemetry.site_id, Telemetry.expected_source)
        .where(Telemetry.expected_source.is_not(None))
        .distinct()
    ):
        sources.setdefault(site_id, set()).add(src)
    out: list[SiteDataSummaryOut] = []
    for site in session.scalars(select(Site).order_by(Site.id)):
        a = agg.get(site.id)
        out.append(
            SiteDataSummaryOut(
                site_id=site.id,
                hours_stored=a.n if a else 0,
                first_hour=_aware(a.first_ts) if a else None,
                last_hour=_aware(a.last_ts) if a else None,
                last_hour_with_data=_aware(a.last_data_ts) if a else None,
                expected_sources=sorted(sources.get(site.id, set())),
            )
        )
    return out


@router.get("/sites/{site_id}", response_model=SiteOut)
def get_site(site_id: str, session: Session = Depends(get_session)) -> Site:
    return _site_or_404(session, site_id)


@router.get("/sites/{site_id}/telemetry", response_model=list[TelemetryOut])
def get_telemetry(
    site_id: str,
    start: datetime | None = Query(None, alias="from"),
    end: datetime | None = Query(None, alias="to"),
    session: Session = Depends(get_session),
) -> list[Telemetry]:
    _site_or_404(session, site_id)
    q = select(Telemetry).where(Telemetry.site_id == site_id).order_by(Telemetry.ts)
    if start is not None:
        if start.tzinfo is None:
            raise HTTPException(422, "'from' must include a timezone offset, e.g. 2026-10-01T00:00:00Z")
        q = q.where(Telemetry.ts >= start)
    if end is not None:
        if end.tzinfo is None:
            raise HTTPException(422, "'to' must include a timezone offset, e.g. 2026-10-10T00:00:00Z")
        q = q.where(Telemetry.ts < end)
    return list(session.scalars(q.limit(20_000)))


@router.post("/sites/{site_id}/telemetry", response_model=UploadResult)
async def upload_telemetry(
    request: Request,
    site_id: str,
    file: UploadFile = File(...),
    timezone: str = Form("UTC"),
    session: Session = Depends(get_session),
) -> UploadResult:
    """Validate a CSV, store hourly telemetry, derive a baseline if needed, then run detection."""
    site = _site_or_404(session, site_id)
    limit = request.app.state.settings.max_upload_bytes
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(413, f"file larger than {limit} bytes")
    try:
        points, report, expected_provided = parse_csv(content, site.capacity_kwp, timezone)
    except IngestError as exc:
        raise HTTPException(422, str(exc)) from exc
    store_points(session, site, points, expected_provided)
    alerts = detect_site(session, site)
    session.commit()
    return UploadResult(
        ingest=IngestReportOut(**report.__dict__),
        alerts=[AlertOut.of(a) for a in alerts],
    )


@router.post("/sites/{site_id}/detect", response_model=DetectionResult)
def rerun_detection(
    site_id: str,
    deviation_threshold_pct: float = Query(10.0, gt=0, le=100),
    min_persistence_hours: int = Query(4, ge=1, le=72),
    critical_deviation_pct: float = Query(20.0, gt=0, le=100),
    session: Session = Depends(get_session),
) -> DetectionResult:
    site = _site_or_404(session, site_id)
    cfg = DetectionConfig(
        deviation_threshold_pct=deviation_threshold_pct,
        min_persistence_hours=min_persistence_hours,
        critical_deviation_pct=critical_deviation_pct,
    )
    alerts = detect_site(session, site, cfg)
    session.commit()
    return DetectionResult(alerts=[AlertOut.of(a) for a in alerts])


# ---- Alerts ----------------------------------------------------------------------------------


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    site_id: str | None = None,
    status: str | None = Query(None, pattern="^(open|closed)$"),
    session: Session = Depends(get_session),
) -> list[AlertOut]:
    q = select(Alert).order_by(Alert.detected_at.desc())
    if site_id:
        q = q.where(Alert.site_id == site_id)
    if status:
        q = q.where(Alert.status == status)
    return [AlertOut.of(a) for a in session.scalars(q)]


@router.get("/alerts/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: str, session: Session = Depends(get_session)) -> AlertOut:
    return AlertOut.of(_alert_or_404(session, alert_id))


@router.post("/alerts/{alert_id}/case", response_model=CaseOut, status_code=201)
def open_case(
    alert_id: str, body: CaseCreateIn | None = None, session: Session = Depends(get_session)
) -> CaseOut:
    alert = _alert_or_404(session, alert_id)
    try:
        case = case_svc.create_case(session, alert, actor=(body.actor if body else "api"))
    except case_svc.CaseError as exc:
        raise HTTPException(409, str(exc)) from exc
    session.commit()
    return CaseOut.of(case, with_events=True)


# ---- Recovery cases --------------------------------------------------------------------------


@router.get("/cases", response_model=list[CaseOut])
def list_cases(
    site_id: str | None = None,
    status: str | None = None,
    sort: str = Query("priority", pattern="^(priority|newest)$"),
    session: Session = Depends(get_session),
) -> list[CaseOut]:
    q = select(RecoveryCase)
    if site_id:
        q = q.where(RecoveryCase.site_id == site_id)
    if status:
        q = q.where(RecoveryCase.status == status)
    items = list(session.scalars(q))
    if sort == "priority":
        items.sort(key=case_svc.priority_key, reverse=True)
        return [
            CaseOut.of(
                c,
                rank_reason=(
                    f"Ranked by severity ({c.severity}), then estimated gap "
                    f"({'n/a' if c.est_gap_kwh is None else f'{c.est_gap_kwh:.0f} kWh'}). "
                    "No confidence term: no model supplies one yet."
                ),
            )
            for c in items
        ]
    items.sort(key=lambda c: c.created_at, reverse=True)
    return [CaseOut.of(c) for c in items]


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(case_id: str, session: Session = Depends(get_session)) -> CaseOut:
    return CaseOut.of(_case_or_404(session, case_id), with_events=True)


@router.patch("/cases/{case_id}", response_model=CaseOut)
def edit_case(case_id: str, body: CaseEditIn, session: Session = Depends(get_session)) -> CaseOut:
    case = _case_or_404(session, case_id)
    try:
        case_svc.edit_case(
            session,
            case,
            actor=body.actor,
            probable_cause=body.probable_cause,
            recoverable_fraction=body.recoverable_fraction,
            recoverable_rationale=body.recoverable_rationale,
            set_recoverable=body.set_recoverable,
        )
    except case_svc.CaseError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    session.commit()
    return CaseOut.of(case, with_events=True)


@router.post("/cases/{case_id}/transition", response_model=CaseOut)
def transition_case(case_id: str, body: TransitionIn, session: Session = Depends(get_session)) -> CaseOut:
    case = _case_or_404(session, case_id)
    try:
        case_svc.transition(
            session,
            case,
            body.to,
            actor=body.actor,
            note=body.note,
            owner=body.owner,
            action_taken=body.action_taken,
            action_started_at=body.action_started_at,
            action_completed_at=body.action_completed_at,
        )
    except case_svc.CaseError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    session.commit()
    return CaseOut.of(case, with_events=True)


@router.post("/cases/{case_id}/verify", response_model=CaseOut)
def verify_case(
    case_id: str, body: VerifyIn | None = None, session: Session = Depends(get_session)
) -> CaseOut:
    body = body or VerifyIn()
    case = _case_or_404(session, case_id)
    site = _site_or_404(session, case.site_id)
    cfg = VerifyConfig(
        pre_days=body.pre_days,
        post_days=body.post_days,
        min_valid_production_hours=body.min_valid_production_hours,
        min_improvement_pts=body.min_improvement_pts,
    )
    try:
        verify_svc.verify_case(session, case, site, cfg, actor=body.actor)
    except case_svc.CaseError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    session.commit()
    return CaseOut.of(case, with_events=True)
