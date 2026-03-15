import io
import math

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field as PydanticField, field_validator
from sqlmodel import Session, select

from auth import create_admin_token, hash_admin_password, verify_admin_password
from models import Team, Player, PlayerRole, AuctionConfig, AuctionStatus, get_session

router = APIRouter(prefix="/setup", tags=["setup"])


class TeamCreate(BaseModel):
    name: str = PydanticField(min_length=1, max_length=64)
    budget: float = PydanticField(gt=0)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Team name cannot be empty")
        return normalized


class AuctionSettings(BaseModel):
    timer_duration: int = PydanticField(default=30, ge=5, le=300)
    admin_password: str = PydanticField(min_length=6, max_length=128)
    autopilot: bool = False


class AdminVerifyBody(BaseModel):
    password: str = PydanticField(min_length=1, max_length=128)


@router.post("/teams")
def register_team(body: TeamCreate, session: Session = Depends(get_session)):
    if not math.isfinite(body.budget):
        raise HTTPException(400, "Budget must be a finite positive number")

    existing = session.exec(select(Team).where(Team.name == body.name)).first()
    if existing:
        raise HTTPException(400, "Team name already taken")
    team = Team(name=body.name, budget_total=body.budget, budget_remaining=body.budget)
    session.add(team)
    session.commit()
    session.refresh(team)
    return {"id": team.id, "name": team.name, "budget_total": team.budget_total}


@router.get("/teams")
def list_teams(session: Session = Depends(get_session)):
    teams = session.exec(select(Team)).all()
    return teams


@router.delete("/teams/{team_id}")
def delete_team(team_id: int, session: Session = Depends(get_session)):
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    session.delete(team)
    session.commit()
    return {"ok": True}


@router.post("/players/upload")
async def upload_players(file: UploadFile = File(...), session: Session = Depends(get_session)):
    filename = (file.filename or "").lower()
    if not filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Only CSV/XLS/XLSX uploads are supported")

    content = await file.read()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    df.columns = [str(col).strip().lower() for col in df.columns]

    required = {"name", "role", "base_price"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(400, f"Missing columns: {missing}")

    if df.empty:
        raise HTTPException(400, "Uploaded file is empty")

    role_map = {
        "batsman": PlayerRole.batsman,
        "batter": PlayerRole.batsman,
        "bowler": PlayerRole.bowler,
        "all-rounder": PlayerRole.all_rounder,
        "allrounder": PlayerRole.all_rounder,
        "all rounder": PlayerRole.all_rounder,
        "wicket-keeper": PlayerRole.wicket_keeper,
        "wicketkeeper": PlayerRole.wicket_keeper,
        "keeper": PlayerRole.wicket_keeper,
        "wk": PlayerRole.wicket_keeper,
    }

    players_added = 0
    errors = []
    for _, row in df.iterrows():
        player_name = str(row.get("name", "")).strip()
        if not player_name:
            errors.append("Found player row with empty name")
            continue

        role_str = str(row.get("role", "")).strip().lower()
        role = role_map.get(role_str)
        if role is None:
            errors.append(f"Unknown role '{row.get('role')}' for player '{row.get('name')}'")
            continue

        try:
            base_price = float(row["base_price"])
        except (TypeError, ValueError):
            errors.append(f"Invalid base_price for player '{player_name}'")
            continue

        if not math.isfinite(base_price) or base_price <= 0:
            errors.append(f"base_price must be positive for player '{player_name}'")
            continue

        player = Player(
            name=player_name,
            role=role,
            base_price=base_price,
            nationality=str(row.get("nationality", "")).strip() or None,
            ipl_team=str(row.get("ipl_team", "")).strip() or None,
        )
        session.add(player)
        players_added += 1

    session.commit()
    return {"players_added": players_added, "errors": errors}


@router.get("/players")
def list_players(session: Session = Depends(get_session)):
    players = session.exec(select(Player)).all()
    return players


@router.delete("/players")
def clear_players(session: Session = Depends(get_session)):
    players = session.exec(select(Player)).all()
    for p in players:
        session.delete(p)
    session.commit()
    return {"ok": True, "deleted": len(players)}


@router.post("/configure")
def configure_auction(body: AuctionSettings, session: Session = Depends(get_session)):
    cfg = session.get(AuctionConfig, 1)
    if cfg is None:
        cfg = AuctionConfig(id=1)
    cfg.status = AuctionStatus.setup
    cfg.timer_duration = body.timer_duration
    cfg.autopilot = body.autopilot
    cfg.current_player_id = None
    cfg.current_highest_bid = None
    cfg.current_highest_team_id = None
    cfg.admin_password_hash = hash_admin_password(body.admin_password)
    session.add(cfg)
    session.commit()
    return {"ok": True, "timer_duration": cfg.timer_duration, "autopilot": cfg.autopilot}


@router.post("/verify-admin")
def verify_admin(body: AdminVerifyBody, session: Session = Depends(get_session)):
    cfg = session.get(AuctionConfig, 1)
    if cfg is None or cfg.admin_password_hash is None:
        raise HTTPException(400, "Auction not configured yet")
    if not verify_admin_password(body.password, cfg.admin_password_hash):
        raise HTTPException(403, "Invalid admin password")
    return {"ok": True, "token_type": "bearer", "token": create_admin_token()}
