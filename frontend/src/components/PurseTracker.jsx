const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(0)} L`;

export default function PurseTracker({ teams, myTeamId }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Team Purses</p>
      <div className="space-y-2">
        {teams?.map((team) => {
          const pct = team.budget_total > 0 ? (team.budget_remaining / team.budget_total) * 100 : 0;
          const isMe = String(team.id) === String(myTeamId);
          return (
            <div key={team.id} className={`rounded-xl p-3 ${isMe ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"}`}>
              <div className="flex justify-between text-sm mb-1">
                <span className={`font-semibold ${isMe ? "text-indigo-700" : "text-gray-700"}`}>
                  {team.name} {isMe && "👈"}
                </span>
                <span className="text-gray-600">{fmt(team.budget_remaining)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
