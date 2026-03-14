import { useState } from "react";
import { AuctionProvider, useAuction } from "../context/AuctionContext";
import PlayerCard from "../components/PlayerCard";
import Timer from "../components/Timer";
import BidHistory from "../components/BidHistory";
import PurseTracker from "../components/PurseTracker";
import axios from "axios";

const API = "http://localhost:8000";

function AdminInner() {
  const { state, timer, bidHistory, connected, adminNext, adminSold, adminUnsold, toggleAutopilot } = useAuction();
  const [starting, setStarting] = useState(false);

  const startAuction = async () => {
    setStarting(true);
    try { await axios.post(`${API}/auction/start`); }
    catch (e) { alert(e.response?.data?.detail || "Could not start auction"); }
    finally { setStarting(false); }
  };

  const isSetup = state?.status === "setup" || !state?.status;
  const isActive = state?.status === "active";
  const isComplete = state?.status === "complete";

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">🎙️ Auctioneer Panel</h1>
          <p className="text-gray-400 text-sm mt-0.5">Admin controls · {connected ? "🟢 Connected" : "🔴 Disconnected"}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Autopilot toggle */}
          <button
            onClick={() => toggleAutopilot(!state?.autopilot)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              state?.autopilot ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            🤖 Autopilot {state?.autopilot ? "ON" : "OFF"}
          </button>
          <a href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-xl text-sm font-semibold transition">
            📊 Dashboard
          </a>
        </div>
      </div>

      {isComplete ? (
        <div className="bg-white rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-2xl font-bold text-gray-800">Auction Complete!</h2>
          <a href="/dashboard" className="inline-block mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700">
            View Results →
          </a>
        </div>
      ) : isSetup ? (
        <div className="flex items-center justify-center py-32">
          <button
            onClick={startAuction}
            disabled={starting}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-2xl font-bold px-12 py-6 rounded-2xl shadow-2xl transition disabled:opacity-60"
          >
            {starting ? "Starting…" : "🚀 Start Auction"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: player + controls */}
          <div className="lg:col-span-2 space-y-4">
            <PlayerCard
              player={state?.current_player}
              highestBid={state?.current_highest_bid}
              highestTeam={state?.current_highest_team}
            />

            {isActive && <Timer seconds={timer} duration={state?.timer_duration} />}

            {/* Admin action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={adminSold}
                className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg shadow transition"
              >
                ✅ Sold
              </button>
              <button
                onClick={adminUnsold}
                className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-lg shadow transition"
              >
                ❌ Unsold
              </button>
              <button
                onClick={adminNext}
                className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg shadow transition"
              >
                ⏭ Next
              </button>
            </div>

            <BidHistory history={bidHistory} />
          </div>

          {/* Right: purses + stats */}
          <div className="space-y-4">
            <PurseTracker teams={state?.teams} />
            <div className="bg-gray-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Players Remaining</p>
              <p className="text-3xl font-bold text-white">{state?.pending_players ?? "—"}</p>
            </div>
            {/* Share links */}
            <div className="bg-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Share with Participants</p>
              <div className="space-y-2">
                {state?.teams?.map((t) => (
                  <div key={t.id} className="bg-gray-700 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-400">{t.name}</p>
                    <p className="text-xs text-indigo-300 font-mono break-all">
                      {window.location.origin}/bid/{t.id}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  return (
    <AuctionProvider teamId="admin">
      <AdminInner />
    </AuctionProvider>
  );
}
