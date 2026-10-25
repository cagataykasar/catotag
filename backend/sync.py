"""Cloud backup of a user's settings and matches.

Every query is scoped to the user taken from the access token; ids in the URL or body
can never reach another user's rows.
"""
import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from sqlalchemy.orm import Session

from auth import get_current_active_user
from db import get_db
from models import Match, User, UserSettings

MAX_SETTINGS_BYTES = 512 * 1024
MAX_MATCH_BYTES = 2 * 1024 * 1024
MAX_MATCHES_PER_USER = 1000
MATCH_ID_PATTERN = r"^[A-Za-z0-9-]{8,36}$"

router = APIRouter(prefix="/sync", tags=["Sync"])


def as_utc(dt: datetime) -> datetime:
    # SQLite drops the timezone; stored values are always UTC
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def ensure_size(data: dict, limit: int):
    if len(json.dumps(data, separators=(",", ":"))) > limit:
        raise HTTPException(status_code=413, detail="Data too large")


# --- Settings ---

class SettingsIn(BaseModel):
    data: dict
    # Version the client last synced (0 = never); a mismatch means another device wrote first
    base_version: int = Field(ge=0)

class SettingsOut(BaseModel):
    data: dict
    version: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("updated_at")
    def _utc(self, dt: datetime):
        return as_utc(dt)


@router.get("/settings", response_model=Optional[SettingsOut])
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return db.get(UserSettings, user.user_id)


@router.put("/settings", response_model=SettingsOut)
def put_settings(
    body: SettingsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    ensure_size(body.data, MAX_SETTINGS_BYTES)
    settings = db.get(UserSettings, user.user_id)
    current_version = settings.version if settings else 0
    if body.base_version != current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Settings were changed on another device", "version": current_version},
        )
    if settings is None:
        settings = UserSettings(user_id=user.user_id, data=body.data, version=1)
        db.add(settings)
    else:
        settings.data = body.data
        settings.version = current_version + 1
    db.commit()
    db.refresh(settings)
    return settings


# --- Matches ---

class MatchIn(BaseModel):
    data: dict

class MatchSummary(BaseModel):
    match_id: str
    team_a: str
    team_b: str
    tag_count: int
    created_at: datetime
    updated_at: datetime

class MatchOut(MatchSummary):
    data: dict


def summarize(match: Match) -> dict:
    data = match.data if isinstance(match.data, dict) else {}
    instances = data.get("instances")
    return {
        "match_id": match.match_id,
        "team_a": str(data.get("teamA") or "")[:100],
        "team_b": str(data.get("teamB") or "")[:100],
        "tag_count": len(instances) if isinstance(instances, list) else 0,
        "created_at": as_utc(match.created_at),
        "updated_at": as_utc(match.updated_at),
    }


def get_own_match(db: Session, user: User, match_id: str) -> Optional[Match]:
    return db.get(Match, (user.user_id, match_id))


MatchId = Path(pattern=MATCH_ID_PATTERN)


@router.get("/matches", response_model=List[MatchSummary])
def list_matches(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    matches = (
        db.query(Match)
        .filter(Match.user_id == user.user_id)
        .order_by(Match.updated_at.desc())
        .all()
    )
    return [summarize(m) for m in matches]


@router.get("/matches/{match_id}", response_model=MatchOut)
def get_match(
    match_id: str = MatchId,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    match = get_own_match(db, user, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return {**summarize(match), "data": match.data}


@router.put("/matches/{match_id}", response_model=MatchSummary)
def put_match(
    body: MatchIn,
    match_id: str = MatchId,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Create or replace a match (one device records a match, so last write wins)."""
    ensure_size(body.data, MAX_MATCH_BYTES)
    match = get_own_match(db, user, match_id)
    if match is None:
        if db.query(Match).filter(Match.user_id == user.user_id).count() >= MAX_MATCHES_PER_USER:
            raise HTTPException(status_code=403, detail="Match limit reached. Delete old matches first.")
        match = Match(user_id=user.user_id, match_id=match_id, data=body.data)
        db.add(match)
    else:
        match.data = body.data
    db.commit()
    db.refresh(match)
    return summarize(match)


@router.delete("/matches/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_match(
    match_id: str = MatchId,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    match = get_own_match(db, user, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    db.delete(match)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
