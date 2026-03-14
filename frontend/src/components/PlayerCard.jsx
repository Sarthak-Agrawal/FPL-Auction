const ROLE_COLORS = {
  Batsman: "bg-blue-100 text-blue-800",
  Bowler: "bg-green-100 text-green-800",
  "All-Rounder": "bg-purple-100 text-purple-800",
  "Wicket-Keeper": "bg-yellow-100 text-yellow-800",
};
const ROLE_EMOJI = { Batsman: "🏏", Bowler: "⚾", "All-Rounder": "⭐", "Wicket-Keeper": "🧤" };

const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(0)} L`;

export default function PlayerCard({ player, highestBid, highestTeam }) {
  if (!player)
    return (
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-400 text-xl">
        ⏳ Waiting for auction to start…
      </div>
    );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-indigo-500">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-4xl">
          {ROLE_EMOJI[player.role] || "🏏"}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{player.name}</h2>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[player.role] || "bg-gray-100 text-gray-600"}`}>
              {player.role}
            </span>
            {player.nationality && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{player.nationality}</span>
            )}
            {player.ipl_team && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{player.ipl_team}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Base Price</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(player.base_price)}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4">
          <p className="text-xs text-indigo-400 uppercase tracking-wide mb-1">Current Bid</p>
          <p className="text-2xl font-bold text-indigo-700">{highestBid ? fmt(highestBid) : "—"}</p>
          {highestTeam && <p className="text-xs text-indigo-500 mt-0.5">by {highestTeam.name}</p>}
        </div>
      </div>
    </div>
  );
}
