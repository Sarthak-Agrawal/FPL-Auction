from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from pydantic import BaseModel
import pandas as pd
import io

from models import Team, Player, PlayerRole, AuctionConfig, get_session
from passlib.context import CryptContext

router = APIRouter(prefix="/setup", tags=["setup"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TeamCreate(BaseModel):
    name: str
    budget: float


class AuctionSettings(BaseModel):
    timer_duration: int = 30
    admin_password: str
    autopilot: bool = False


@router.post("/teams")
def register_team(body: TeamCreate, session: Session = Depends(get_session)):
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
    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    required = {"name", "role", "base_price"}
    missing = required - set(df.columns.str.lower())
    if missing:
        raise HTTPException(400, f"Missing columns: {missing}")

    df.columns = df.columns.str.lower().str.strip()

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
        role_str = str(row.get("role", "")).strip().lower()
        role = role_map.get(role_str)
        if role is None:
            errors.append(f"Unknown role '{row.get('role')}' for player '{row.get('name')}'")
            continue
        player = Player(
            name=str(row["name"]).strip(),
            role=role,
            base_price=float(row["base_price"]),
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
    cfg.timer_duration = body.timer_duration
    cfg.autopilot = body.autopilot
    cfg.admin_password_hash = pwd_ctx.hash(body.admin_password)
    session.add(cfg)
    session.commit()
    return {"ok": True, "timer_duration": cfg.timer_duration, "autopilot": cfg.autopilot}


@router.post("/verify-admin")
def verify_admin(body: dict, session: Session = Depends(get_session)):
    cfg = session.get(AuctionConfig, 1)
    if cfg is None or cfg.admin_password_hash is None:
        raise HTTPException(400, "Auction not configured yet")
    if not pwd_ctx.verify(body.get("password", ""), cfg.admin_password_hash):
        raise HTTPException(403, "Invalid admin password")
    return {"ok": True}
