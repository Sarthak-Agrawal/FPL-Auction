import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { API_BASE_URL } from "../config";

export default function Setup() {
  const nav = useNavigate();
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [budget, setBudget] = useState(1000000000); // 100 Cr default
  const [file, setFile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [timerDuration, setTimerDuration] = useState(30);
  const [adminPwd, setAdminPwd] = useState("");
  const [autopilot, setAutopilot] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const notify = (m, isErr = false) => {
    isErr ? setError(m) : setMsg(m);
    setTimeout(() => { setMsg(""); setError(""); }, 3000);
  };

  const addTeam = async () => {
    if (!teamName.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/setup/teams`, { name: teamName.trim(), budget: Number(budget) });
      setTeams((t) => [...t, res.data]);
      setTeamName("");
      notify(`✅ Team "${res.data.name}" registered`);
    } catch (e) {
      notify(e.response?.data?.detail || "Error adding team", true);
    }
  };

  const removeTeam = async (id) => {
    await axios.delete(`${API_BASE_URL}/setup/teams/${id}`);
    setTeams((t) => t.filter((x) => x.id !== id));
  };

  const uploadCSV = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await axios.post(`${API_BASE_URL}/setup/players/upload`, fd);
      notify(`✅ ${res.data.players_added} players uploaded. ${res.data.errors.length ? res.data.errors[0] : ""}`);
      const all = await axios.get(`${API_BASE_URL}/setup/players`);
      setPlayers(all.data);
    } catch (e) {
      notify(e.response?.data?.detail || "Upload failed", true);
    }
  };

  const configure = async () => {
    if (!adminPwd) { notify("Admin password required", true); return; }
    if (teams.length < 2) { notify("Register at least 2 teams", true); return; }
    if (players.length === 0) { notify("Upload player list first", true); return; }
    try {
      await axios.post(`${API_BASE_URL}/setup/configure`, { timer_duration: timerDuration, admin_password: adminPwd, autopilot });
      const verify = await axios.post(`${API_BASE_URL}/setup/verify-admin`, { password: adminPwd });
      localStorage.setItem("fpl_admin_token", verify.data.token);
      notify("✅ Auction configured! Redirecting to admin…");
      setTimeout(() => nav("/admin"), 1500);
    } catch (e) {
      notify(e.response?.data?.detail || "Config failed", true);
    }
  };

  const fmt = (v) => v >= 1e7 ? `₹${(v / 1e7).toFixed(0)} Cr` : `₹${(v / 1e5).toFixed(0)} L`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">🏏 FPL Auction Setup</h1>
        <p className="text-indigo-300 mb-8">Configure teams, players and auction settings before you begin.</p>

        {msg && <div className="bg-green-100 text-green-800 rounded-xl px-4 py-2 mb-4 text-sm">{msg}</div>}
        {error && <div className="bg-red-100 text-red-800 rounded-xl px-4 py-2 mb-4 text-sm">{error}</div>}

        {/* Teams */}
        <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">1. Register Teams</h2>
          <div className="flex gap-2 mb-4">
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget (₹)"
              className="w-36 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={addTeam} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">Add</button>
          </div>
          {teams.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No teams registered yet.</p>
          ) : (
            <div className="space-y-2">
              {teams.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-2">
                  <span className="font-medium text-gray-700">{t.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{fmt(t.budget_total)}</span>
                    <button onClick={() => removeTeam(t.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Players */}
        <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">2. Upload Player List</h2>
          <p className="text-xs text-gray-400 mb-4">CSV/Excel with columns: <code>name, role, base_price, nationality, ipl_team</code></p>
          <div className="flex gap-2 mb-3">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files[0])}
              className="flex-1 text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            <button onClick={uploadCSV} disabled={!file}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white disabled:text-gray-400 px-4 py-2 rounded-xl text-sm font-semibold">
              Upload
            </button>
          </div>
          {players.length > 0 && (
            <p className="text-sm text-green-600 font-medium">✅ {players.length} players loaded</p>
          )}
        </section>

        {/* Config */}
        <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">3. Auction Settings</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bid Timer (seconds)</label>
              <input type="number" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Admin Password</label>
              <input type="password" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className={`w-10 h-6 rounded-full transition ${autopilot ? "bg-indigo-500" : "bg-gray-300"}`}
              onClick={() => setAutopilot((v) => !v)}>
              <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${autopilot ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700">Start in Autopilot mode</span>
          </label>
        </section>

        <button onClick={configure}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-2xl text-lg font-bold shadow-lg transition">
          🚀 Save & Go to Admin Panel
        </button>
      </div>
    </div>
  );
}
