const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(0)} L`;

export default function BidHistory({ history }) {
  if (!history?.length)
    return (
      <div className="bg-white rounded-2xl shadow p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Bid History</p>
        <p className="text-sm text-gray-400 text-center py-4">No bids yet</p>
      </div>
    );

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Bid History</p>
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {history.map((b, i) => (
          <div key={i} className={`flex justify-between items-center text-sm px-3 py-1.5 rounded-lg ${i === 0 ? "bg-indigo-50 font-semibold" : "bg-gray-50"}`}>
            <span className="text-gray-700">{b.team}</span>
            <div className="text-right">
              <span className="text-indigo-700">{fmt(b.amount)}</span>
              <span className="text-gray-400 text-xs ml-2">{b.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
