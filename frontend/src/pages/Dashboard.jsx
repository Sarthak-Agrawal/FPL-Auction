import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const fmt = (v) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(0)} L`);

const ROLE_COLORS = {
  Batsman: "bg-blue-100 text-blue-700",
  Bowler: "bg-green-100 text-green-700",
  "All-Rounder": "bg-purple-100 text-purple-700",
  "Wicket-Keeper": "bg-yellow-100 text-yellow-700",
};

export default function Dashboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [sold, setSold] = useState([]);
  const [unsold, setUnsold] = useState([]);
  const [stats, setStats] = useState(null);
  const [squads, setSquads] = useState({});
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [roleFilter, setRoleFilter] = useState("All");

  const load = async () => {
    const [lb, s, u, st] = await Promise.all([
      axios.get(`${API}/dashboard/leaderboard`),
      axios.get(`${API}/dashboard/players/sold`),
      axios.get(`${API}/dashboard/players/unsold`),
      axios.get(`${API}/dashboard/stats`),
    ]);
    setLeaderboard(lb.data);
    setSold(s.data);
    setUnsold(u.data);
    setStats(st.data);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const toggleSquad = async (teamId) => {
    if (expandedTeam === teamId) { setExpandedTeam(null); return; }
    setExpandedTeam(teamId);
    if (!squads[teamId]) {
      const res = await axios.get(`${API}/dashboard/team/${teamId}/squad`);
      setSquads((s) => ({ ...s, [teamId]: res.data.squad }));
    }
  };

  const exportCSV = () => {
    const rows = [["Name", "Role", "Base Price", "Sold Price", "Sold To", "Nationality", "IPL Team"]];
    sold.forEach((p) => rows.push([p.name, p.role, p.base_price, p.sold_price, p.sold_to, p.nationality, p.ipl_team]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fpl_auction_results.csv"; a.click();
  };

  const roles = ["All", "Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"];
  const filteredSold = roleFilter === "All" ? sold : sold.filter((p) => p.role === roleFilter);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📊 Auction Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Auto-refreshes every 5s</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition">
              ⬇ Export CSV
            </button>
            <a href="/admin" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
              🎙️ Admin Panel
            </a>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Players", value: stats.total, color: "text-gray-800" },
              { label: "Sold", value: stats.sold, color: "text-green-600" },
              { label: "Unsold", value: stats.unsold, color: "text-red-500" },
              { label: "Pending", value: stats.pending, color: "text-indigo-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <section className="bg-white rounded-2xl shadow mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">🏆 Team Leaderboard</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">#</th>
                <th className="px-6 py-3 text-left">Team</th>
                <th className="px-6 py-3 text-right">Players</th>
                <th className="px-6 py-3 text-right">Spent</th>
                <th className="px-6 py-3 text-right">Remaining</th>
                <th className="px-6 py-3 text-right">Squad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaderboard.map((team, i) => (
                <>
                  <tr key={team.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-gray-400">{i + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{team.name}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{team.players_count}</td>
                    <td className="px-6 py-4 text-right text-red-500 font-medium">{fmt(team.spent)}</td>
                    <td className="px-6 py-4 text-right text-green-600 font-medium">{fmt(team.budget_remaining)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => toggleSquad(team.id)} className="text-indigo-600 hover:underline text-xs font-semibold">
                        {expandedTeam === team.id ? "Hide ▲" : "View ▼"}
                      </button>
                    </td>
                  </tr>
                  {expandedTeam === team.id && squads[team.id] && (
                    <tr key={`squad-${team.id}`}>
                      <td colSpan={6} className="px-6 pb-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {squads[team.id].map((p) => (
                            <div key={p.id} className="bg-gray-50 rounded-xl p-2.5">
                              <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                              <div className="flex justify-between mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_COLORS[p.role] || "bg-gray-100 text-gray-600"}`}>{p.role}</span>
                                <span className="text-xs text-indigo-700 font-medium">{fmt(p.sold_price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </section>

        {/* Sold Players */}
        <section className="bg-white rounded-2xl shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">🟢 Sold Players ({sold.length})</h2>
            <div className="flex gap-1">
              {roles.map((r) => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${roleFilter === r ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSold.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-xl p-3 hover:shadow-sm transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_COLORS[p.role] || "bg-gray-100 text-gray-500"}`}>{p.role}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-700 font-bold text-sm">{fmt(p.sold_price)}</p>
                    <p className="text-xs text-gray-500">{p.sold_to}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Unsold Players */}
        {unsold.length > 0 && (
          <section className="bg-white rounded-2xl shadow">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">🔴 Unsold Players ({unsold.length})</h2>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {unsold.map((p) => (
                <span key={p.id} className="bg-red-50 text-red-700 text-sm px-3 py-1.5 rounded-full border border-red-100">
                  {p.name} · {p.role}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
