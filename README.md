# 🏏 FPL Auction

A real-time IPL-style player auction app for friends across the globe. Everyone joins via their browser — bids are live, purses are tracked, and the auctioneer controls the flow.

---

## Quick Start

### 1. Backend (Python FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API runs at: http://localhost:8000  
API docs: http://localhost:8000/docs

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App runs at: http://localhost:5173

---

## How to Run an Auction

### Step 1 — Setup (Admin only)
1. Open http://localhost:5173/setup
2. Register all participating teams (name + budget, e.g. ₹100 Cr = 1000000000)
3. Upload `sample_players.csv` (or your own CSV)
4. Set timer duration (default 30s) and admin password
5. Click **Save & Go to Admin Panel**

### Step 2 — Share bidder links
From the Admin Panel, share each team's unique link:
```
http://<your-ip>:5173/bid/<team_id>
```
Each participant opens their link on their own browser/device.

### Step 3 — Start the Auction
- Click **🚀 Start Auction** from the Admin Panel
- Players appear one by one; the countdown timer starts
- Participants click bid buttons (+10L, +20L, +1Cr) or type a custom amount
- Each new bid resets the timer
- Timer hits 0 → player auto-sold to highest bidder
- No bids → player marked Unsold

### Step 4 — Autopilot Mode
Toggle **🤖 Autopilot** ON to advance to the next player automatically after each sold/unsold event. Useful when the admin steps away.

### Step 5 — Dashboard
Open http://localhost:5173/dashboard at any time to see:
- Live leaderboard
- Team squads
- Sold/unsold player list with role filters
- Export to CSV

---

## CSV Format

```csv
name,role,base_price,nationality,ipl_team
Virat Kohli,Batsman,200000000,Indian,RCB
Jasprit Bumrah,Bowler,200000000,Indian,MI
```

**Accepted roles:** `Batsman`, `Bowler`, `All-Rounder`, `Wicket-Keeper`  
**base_price** is in rupees (₹2 Cr = `20000000`)

---

## Project Structure

```
FPL-Auction/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── models.py            # DB models (SQLModel + SQLite)
│   ├── auction_engine.py    # Auction state machine + timer
│   ├── ws_manager.py        # WebSocket broadcast manager
│   ├── routers/
│   │   ├── setup.py         # Team registration, CSV upload
│   │   ├── auction.py       # Auction control + WebSocket endpoint
│   │   └── dashboard.py     # Read-only stats and squads
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Setup.jsx       # Pre-auction admin setup
│       │   ├── AdminPanel.jsx  # Live auctioneer controls
│       │   ├── BidView.jsx     # Participant bidding screen
│       │   └── Dashboard.jsx   # Leaderboard + results
│       ├── components/         # PlayerCard, Timer, BidControls, etc.
│       └── context/
│           └── AuctionContext.jsx  # Shared WebSocket state
├── sample_players.csv
└── README.md
```

🏏 FPL-Auction — Complete!

  ./FPL-Auction

  To run it:

  Terminal 1 — Backend:

   cd FPL-Auction/backend
   source venv/bin/activate
   uvicorn main:app --reload --host 0.0.0.0 --port 8000

  Terminal 2 — Frontend:

   cd FPL-Auction/frontend
   npm run dev -- --host

  Then:

   1. Admin → http://localhost:5173/setup — register teams, upload sample_players.csv, set password
   2. Admin panel → http://localhost:5173/admin — start auction, control flow, toggle autopilot
   3. Each participant opens their unique link → http://<your-ip>:5173/bid/<team_id>
   4. Dashboard → http://localhost:5173/dashboard — live leaderboard & results

  Key features built:

   - 🔴 Real-time bidding via WebSockets — all participants see bids instantly
   - ⏱ Countdown timer that resets on every new bid
   - 🤖 Autopilot mode — auto-advances without admin intervention
   - 💰 Purse tracker — teams can't overbid their budget
   - 📁 CSV upload for player list
   - 📊 Dashboard with leaderboard, squad viewer, role filters, CSV export
