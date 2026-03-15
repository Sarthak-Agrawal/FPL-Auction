# IPL Auction App — Implementation Plan

## Status Update (2026-03-15)
- Project is implemented at `FPL-Auction/` (backend + frontend).
- Post-review remediation is complete:
  - Admin authentication enforced on auction-control REST and WebSocket admin events.
  - Bid identity spoofing fixed (team identity now comes from WebSocket path, not client payload).
  - Equal-bid acceptance fixed (new bids must exceed current highest bid).
  - Frontend API/WS endpoints moved to environment-driven config (`VITE_API_URL`, `VITE_WS_URL`).
  - CORS hardened with explicit allowed origins (`ALLOWED_ORIGINS`).
  - Setup validation hardened for team budget, timer range, password length, CSV file type and base price validity.
  - Auction mutations serialized with an async lock to prevent race conditions during concurrent bids/sells.

## Overview
A real-time web-based IPL auction platform where geographically distributed friends can participate in a live player auction via their browsers. Participants register before the auction; an auctioneer/admin drives the flow with an optional **autopilot** mode.

---

## Requirements Summary
| Feature | Decision |
|---|---|
| App type | Real-time web app |
| Backend | Python FastAPI + WebSockets |
| Frontend | React + Vite + TailwindCSS |
| Real-time | WebSockets (built into FastAPI) |
| Database | SQLite (via SQLModel/SQLAlchemy) |
| Player data input | CSV upload |
| Player categories | Batsmen, Bowlers, All-rounders, Wicket-keepers |
| Bidding | Fixed increment buttons + free-form input |
| Budget | Each team has a purse cap |
| Timer | Countdown per player; resets on each new bid; auto-sell at 0 |
| Squad size | Unlimited (budget is the only constraint) |
| Admin | 1 admin role + autopilot mode fallback |

---

## Architecture

```
ipl-auction/
├── backend/
│   ├── main.py               # FastAPI app, REST + WebSocket routes
│   ├── models.py             # SQLModel DB models (Team, Player, Bid, AuctionState)
│   ├── auction_engine.py     # Core auction state machine (bids, timer, autopilot)
│   ├── ws_manager.py         # WebSocket connection manager (broadcast to all)
│   ├── routers/
│   │   ├── setup.py          # Pre-auction: register teams, upload CSV
│   │   ├── auction.py        # Admin controls: start, next, sold, unsold, autopilot
│   │   └── dashboard.py      # Read-only: team squads, purse, sold players
│   ├── requirements.txt
│   └── auction.db            # SQLite DB (auto-created)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Setup.jsx         # Admin: register teams, upload CSV
    │   │   ├── AdminPanel.jsx    # Admin: control auction flow
    │   │   ├── BidderView.jsx    # Participant: place bids, see purse
    │   │   └── Dashboard.jsx     # All: live leaderboard, squads, stats
    │   ├── components/
    │   │   ├── PlayerCard.jsx    # Current player on auction
    │   │   ├── BidControls.jsx   # Fixed increment + free-form bid input
    │   │   ├── Timer.jsx         # Countdown timer
    │   │   ├── PurseTracker.jsx  # Team budget remaining
    │   │   └── BidHistory.jsx    # Recent bids feed
    │   ├── hooks/useAuctionSocket.js  # WebSocket hook
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

---

## Key Flows

### Pre-Auction Setup (Admin)
1. Admin opens the app and enters admin password
2. Registers K teams (team name + budget cap)
3. Uploads a CSV file with columns: `name, role, base_price, nationality, ipl_team`
4. System parses and loads players into DB, grouped by category
5. Admin sets timer duration (e.g., 30s) and autopilot toggle

### Auction Flow
1. Admin clicks "Start Auction"
2. First player appears (shuffled within category or order-preserving)
3. All participants see: player card, base price, countdown timer
4. Participants bid using fixed buttons (+10L, +20L, +50L) or custom input
5. Each new bid resets the countdown timer
6. When timer hits 0 → player sold to highest bidder; purse deducted
7. If no bids before timer → player marked Unsold
8. Admin (or autopilot) advances to next player

### Autopilot Mode
- Admin can toggle autopilot ON
- System auto-advances to next player after each sold/unsold event
- Timer auto-starts for each player
- No manual intervention needed

### Roles & Auth
- **Admin**: password-protected (set at setup time); can control everything
- **Participants**: join with team name; can only bid during active auction
- No complex auth — simple session token per team

---

## Data Models

### Team
```
id, name, budget_total, budget_remaining, created_at
```

### Player
```
id, name, role (enum), base_price, nationality, ipl_team, status (unsold/sold/pending), sold_to_team_id, sold_price
```

### Bid
```
id, player_id, team_id, amount, timestamp
```

### AuctionState (singleton)
```
current_player_id, status (setup/active/paused/complete), autopilot, timer_duration, timer_remaining, current_highest_bid, current_highest_team_id
```

---

## WebSocket Events

| Event (Server → Client) | Payload |
|---|---|
| `auction_state` | Full current state snapshot |
| `bid_placed` | team, amount, timer_reset |
| `player_sold` | player, team, price |
| `player_unsold` | player |
| `next_player` | player details |
| `timer_tick` | seconds_remaining |
| `auction_complete` | final summary |

| Event (Client → Server) | Payload |
|---|---|
| `place_bid` | team_id, amount |
| `admin_next` | — |
| `admin_sold` | — |
| `admin_unsold` | — |
| `admin_toggle_autopilot` | enabled |

---

## CSV Format
```csv
name,role,base_price,nationality,ipl_team
Virat Kohli,Batsman,200000000,Indian,RCB
Jasprit Bumrah,Bowler,150000000,Indian,MI
MS Dhoni,Wicket-Keeper,100000000,Indian,CSK
```
`base_price` in rupees (e.g., 2 Cr = 20000000)

---

## Implementation Todos (ordered)

1. **project-scaffold** — Scaffold project directory structure (ipl-auction/backend + frontend)
2. **backend-models** — Define SQLModel DB models (Team, Player, Bid, AuctionState)
3. **backend-setup-routes** — REST endpoints: register teams, upload CSV, configure auction
4. **backend-auction-engine** — Core auction state machine with timer logic
5. **backend-autopilot** — Autopilot background task (asyncio) that advances auction automatically
6. **backend-websocket** — WebSocket connection manager + broadcast logic
7. **backend-auction-routes** — WebSocket + REST endpoints for auction control and bidding
8. **backend-dashboard-routes** — Read-only endpoints for squads, leaderboard, sold players
9. **frontend-scaffold** — Vite + React + Tailwind setup, routing
10. **frontend-socket-hook** — useAuctionSocket hook for shared WS connection + state
11. **frontend-setup-page** — Admin setup: register teams, upload CSV, configure auction
12. **frontend-bidder-view** — Participant view: player card, bid controls, timer, purse
13. **frontend-admin-panel** — Admin controls: next/sold/unsold/autopilot toggle overlay
14. **frontend-dashboard** — Live leaderboard, team squads, stats page
15. **integration-test** — End-to-end smoke test: setup → bid → sell → complete
