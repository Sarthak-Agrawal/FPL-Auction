import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

import { AuctionProvider } from "../context/AuctionContext";
import { useAuction } from "../context/useAuction";
import Timer from "../components/Timer";
import { API_BASE_URL } from "../config";

const fmt = (value) => (value >= 1e7 ? `₹${(value / 1e7).toFixed(2)} Cr` : `₹${(value / 1e5).toFixed(0)} L`);

function TeamPageInner({ details, loading, error, teamId }) {
  const { state, timer, timerDisabled, connected } = useAuction();

  const liveTeam = state?.teams?.find((team) => String(team.id) === String(teamId));
  const baseTeam = details?.team || (liveTeam ? { ...liveTeam, spent: 0, players_count: 0 } : null);
  const team = baseTeam
    ? {
        ...baseTeam,
        budget_remaining: liveTeam ? liveTeam.budget_remaining : baseTeam.budget_remaining,
        spent: liveTeam ? liveTeam.budget_total - liveTeam.budget_remaining : baseTeam.spent,
      }
    : null;

  const currentPlayer = state?.current_player;
  const currentHighestBid = state?.current_highest_bid;
  const minRequiredBid = currentPlayer
    ? (currentHighestBid == null ? currentPlayer.base_price : currentHighestBid + 1)
    : null;
  const canOutbid = team && minRequiredBid != null ? team.budget_remaining >= minRequiredBid : false;
  const shortfall = team && minRequiredBid != null ? Math.max(0, minRequiredBid - team.budget_remaining) : 0;

  const squadByRole = useMemo(() => {
    const grouped = {};
    for (const player of details?.squad || []) {
      if (!grouped[player.role]) grouped[player.role] = [];
      grouped[player.role].push(player);
    }
    return grouped;
  }, [details?.squad]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🏟 Team Page</h1>
            {team && <p className="text-gray-600 text-sm mt-1">{team.name}</p>}
          </div>
          <div className="flex gap-2">
            <a href={`/bid/${teamId}`} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Bidder View
            </a>
            <a href="/dashboard" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold">
              Back to Dashboard
            </a>
          </div>
        </div>

        {loading && <div className="bg-white rounded-2xl shadow p-6 text-gray-500">Loading team details...</div>}
        {error && <div className="bg-red-100 text-red-700 rounded-2xl p-4 mb-4 text-sm">{error}</div>}

        {!loading && !error && team && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Purse</p>
                <p className="text-xl font-bold text-gray-800 mt-1">{fmt(team.budget_total)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Remaining Purse</p>
                <p className="text-xl font-bold text-green-600 mt-1">{fmt(team.budget_remaining)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Spent</p>
                <p className="text-xl font-bold text-red-500 mt-1">{fmt(team.spent)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Players Bought</p>
                <p className="text-xl font-bold text-indigo-600 mt-1">{details?.squad?.length ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <section className="lg:col-span-2 bg-white rounded-2xl shadow p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">Live Auction Status</h2>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {connected ? "Live" : "Reconnecting"}
                  </span>
                </div>

                {state?.status !== "active" || !currentPlayer ? (
                  <p className="text-gray-500 text-sm">No active player currently on bid.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Current Player</p>
                        <p className="font-semibold text-gray-800">{currentPlayer.name}</p>
                        <p className="text-xs text-gray-500">{currentPlayer.role}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <p className="text-xs text-indigo-400 uppercase tracking-wide">Current Highest</p>
                        <p className="font-semibold text-indigo-700">
                          {currentHighestBid == null ? fmt(currentPlayer.base_price) : fmt(currentHighestBid)}
                        </p>
                        <p className="text-xs text-indigo-500">
                          {state?.current_highest_team?.name ? `by ${state.current_highest_team.name}` : "No bids yet"}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Can This Team Outbid?</p>
                        <p className={`font-semibold ${canOutbid ? "text-green-600" : "text-red-500"}`}>
                          {canOutbid ? "Yes" : "No"}
                        </p>
                        {minRequiredBid != null && (
                          <p className="text-xs text-gray-500">
                            Need {fmt(minRequiredBid)}
                            {!canOutbid && shortfall > 0 ? ` (short by ${fmt(shortfall)})` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <Timer
                      seconds={timer}
                      duration={state?.timer_duration}
                      disabled={timerDisabled}
                    />
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl shadow p-5">
                <h2 className="text-lg font-bold text-gray-800 mb-3">Spend by Role</h2>
                {!details?.spend_by_role?.length ? (
                  <p className="text-sm text-gray-500">No purchases yet.</p>
                ) : (
                  <div className="space-y-2">
                    {details.spend_by_role.map((row) => (
                      <div key={row.role} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-gray-700">{row.role}</span>
                          <span className="text-indigo-700 font-semibold">{fmt(row.spend)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{row.count} player(s)</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Squad</h2>
              {!details?.squad?.length ? (
                <p className="text-sm text-gray-500">This team has not bought any player yet.</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(squadByRole).map(([role, players]) => (
                    <div key={role}>
                      <h3 className="text-sm font-semibold text-gray-600 mb-2">{role}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {players.map((player) => (
                          <div key={player.id} className="border border-gray-100 rounded-xl p-3">
                            <p className="font-semibold text-gray-800">{player.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {player.nationality || "Unknown"}{player.ipl_team ? ` · ${player.ipl_team}` : ""}
                            </p>
                            <div className="mt-2 flex justify-between text-xs">
                              <span className="text-gray-500">Bought at</span>
                              <span className="font-semibold text-indigo-700">{fmt(player.sold_price || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { teamId } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${API_BASE_URL}/dashboard/team/${teamId}/details`);
        if (mounted) setDetails(res.data);
      } catch (e) {
        if (mounted) setError(e.response?.data?.detail || "Could not load team details");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [teamId]);

  return (
    <AuctionProvider teamId={teamId}>
      <TeamPageInner details={details} loading={loading} error={error} teamId={teamId} />
    </AuctionProvider>
  );
}
