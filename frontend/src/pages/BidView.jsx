import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AuctionProvider, useAuction } from "../context/AuctionContext";
import PlayerCard from "../components/PlayerCard";
import Timer from "../components/Timer";
import BidControls from "../components/BidControls";
import PurseTracker from "../components/PurseTracker";
import BidHistory from "../components/BidHistory";

function BidViewInner({ teamId }) {
  const { state, timer, bidHistory, connected, placeBid } = useAuction();

  const myTeam = state?.teams?.find((t) => String(t.id) === String(teamId));
  const isActive = state?.status === "active";
  const timerUp = timer === 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏏 FPL Auction</h1>
          {myTeam && <p className="text-sm text-indigo-600 font-medium">Playing as: {myTeam.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-xs text-gray-500">{connected ? "Live" : "Reconnecting…"}</span>
          {state?.status === "complete" && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Auction Complete</span>
          )}
          {state?.autopilot && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">🤖 Autopilot</span>
          )}
        </div>
      </div>

      {state?.status === "complete" ? (
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-2xl font-bold text-gray-800">Auction Complete!</h2>
          <p className="text-gray-500 mt-2">All players have been auctioned. Check the dashboard for results.</p>
          <a href="/dashboard" className="inline-block mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition">
            View Dashboard →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <PlayerCard
              player={state?.current_player}
              highestBid={state?.current_highest_bid}
              highestTeam={state?.current_highest_team}
            />
            {isActive && <Timer seconds={timer} duration={state?.timer_duration} />}
            {isActive && myTeam && (
              <BidControls
                currentBid={state?.current_highest_bid}
                basePrice={state?.current_player?.base_price}
                budget={myTeam.budget_remaining}
                onBid={placeBid}
                disabled={timerUp || !state?.current_player}
              />
            )}
            <BidHistory history={bidHistory} />
          </div>
          <div className="space-y-4">
            <PurseTracker teams={state?.teams} myTeamId={teamId} />
            <div className="bg-white rounded-2xl shadow p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Players Remaining</p>
              <p className="text-3xl font-bold text-gray-800">{state?.pending_players ?? "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BidView() {
  const { teamId } = useParams();
  return (
    <AuctionProvider teamId={teamId}>
      <BidViewInner teamId={teamId} />
    </AuctionProvider>
  );
}
