import { useState } from "react";
import axios from "axios";

import { AuctionProvider } from "../context/AuctionContext";
import { useAuction } from "../context/useAuction";
import PlayerCard from "../components/PlayerCard";
import Timer from "../components/Timer";
import BidHistory from "../components/BidHistory";
import PurseTracker from "../components/PurseTracker";
import { API_BASE_URL } from "../config";

function AdminInner({ adminToken }) {
  const { state, timer, bidHistory, connected, socketError, adminNext, adminSold, adminUnsold, toggleAutopilot } = useAuction();
  const [starting, setStarting] = useState(false);

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
  };

  const startAuction = async () => {
    setStarting(true);
    try {
      await axios.post(`${API_BASE_URL}/auction/start`, {}, { headers: adminHeaders });
    } catch (e) {
      alert(e.response?.data?.detail || "Could not start auction");
    } finally {
      setStarting(false);
    }
  };

  const isSetup = state?.status === "setup" || !state?.status;
  const isActive = state?.status === "active";
  const isComplete = state?.status === "complete";

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">🎙️ Auctioneer Panel</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Admin controls · {connected ? "🟢 Connected" : "🔴 Disconnected"}
          </p>
          {socketError && <p className="text-red-400 text-xs mt-1">{socketError}</p>}
        </div>
        <div className="flex items-center gap-3">
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
          <div className="lg:col-span-2 space-y-4">
            <PlayerCard
              player={state?.current_player}
              highestBid={state?.current_highest_bid}
              highestTeam={state?.current_highest_team}
            />

            {isActive && <Timer seconds={timer} duration={state?.timer_duration} />}

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

          <div className="space-y-4">
            <PurseTracker teams={state?.teams} />
            <div className="bg-gray-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Players Remaining</p>
              <p className="text-3xl font-bold text-white">{state?.pending_players ?? "—"}</p>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Share with Participants</p>
              <div className="space-y-2">
                {state?.teams?.map((team) => (
                  <div key={team.id} className="bg-gray-700 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-400">{team.name}</p>
                    <p className="text-xs text-indigo-300 font-mono break-all">
                      {window.location.origin}/bid/{team.id}
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
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("fpl_admin_token") || "");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!password) {
      setAuthError("Enter admin password");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const res = await axios.post(`${API_BASE_URL}/setup/verify-admin`, { password });
      localStorage.setItem("fpl_admin_token", res.data.token);
      setAdminToken(res.data.token);
      setPassword("");
    } catch (e) {
      setAuthError(e.response?.data?.detail || "Invalid admin password");
    } finally {
      setLoading(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Login</h1>
          <p className="text-sm text-gray-500 mb-4">Enter the admin password configured during setup.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {authError && <p className="text-red-500 text-xs mt-2">{authError}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold"
          >
            {loading ? "Verifying..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuctionProvider teamId="admin" adminToken={adminToken}>
      <AdminInner adminToken={adminToken} />
    </AuctionProvider>
  );
}
