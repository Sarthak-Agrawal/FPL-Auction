from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from models import Team, Player, PlayerStatus, Bid, get_session

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/leaderboard")
def leaderboard(session: Session = Depends(get_session)):
    teams = session.exec(select(Team)).all()
    result = []
    for team in teams:
        players = session.exec(
            select(Player).where(
                Player.sold_to_team_id == team.id,
                Player.status == PlayerStatus.sold,
            )
        ).all()
        result.append(
            {
                "id": team.id,
                "name": team.name,
                "budget_total": team.budget_total,
                "budget_remaining": team.budget_remaining,
                "spent": team.budget_total - team.budget_remaining,
                "players_count": len(players),
            }
        )
    result.sort(key=lambda x: x["players_count"], reverse=True)
    return result


@router.get("/team/{team_id}/squad")
def team_squad(team_id: int, session: Session = Depends(get_session)):
    team = session.get(Team, team_id)
    if not team:
        return {"error": "Team not found"}
    players = session.exec(
        select(Player).where(
            Player.sold_to_team_id == team_id,
            Player.status == PlayerStatus.sold,
        )
    ).all()
    return {"team": team, "squad": players}


@router.get("/players/sold")
def sold_players(session: Session = Depends(get_session)):
    players = session.exec(select(Player).where(Player.status == PlayerStatus.sold)).all()
    result = []
    for p in players:
        team = session.get(Team, p.sold_to_team_id) if p.sold_to_team_id else None
        result.append(
            {
                "id": p.id,
                "name": p.name,
                "role": p.role,
                "base_price": p.base_price,
                "sold_price": p.sold_price,
                "sold_to": team.name if team else None,
                "nationality": p.nationality,
                "ipl_team": p.ipl_team,
            }
        )
    return result


@router.get("/players/unsold")
def unsold_players(session: Session = Depends(get_session)):
    return session.exec(select(Player).where(Player.status == PlayerStatus.unsold)).all()


@router.get("/players/pending")
def pending_players(session: Session = Depends(get_session)):
    return session.exec(select(Player).where(Player.status == PlayerStatus.pending)).all()


@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    total = len(session.exec(select(Player)).all())
    sold = len(session.exec(select(Player).where(Player.status == PlayerStatus.sold)).all())
    unsold = len(session.exec(select(Player).where(Player.status == PlayerStatus.unsold)).all())
    pending = total - sold - unsold
    return {"total": total, "sold": sold, "unsold": unsold, "pending": pending}
