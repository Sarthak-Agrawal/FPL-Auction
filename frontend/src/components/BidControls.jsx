import { useState } from "react";

const INCREMENTS = [
  { label: "+10L", value: 1_000_000 },
  { label: "+20L", value: 2_000_000 },
  { label: "+50L", value: 5_000_000 },
  { label: "+1Cr", value: 10_000_000 },
  { label: "+2Cr", value: 20_000_000 },
];

const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : `₹${(v / 1e5).toFixed(0)} L`;

export default function BidControls({ currentBid, basePrice, budget, onBid, disabled }) {
  const [custom, setCustom] = useState("");
  const minNext = (currentBid ?? basePrice ?? 0);

  const handleIncrement = (inc) => {
    const amount = minNext + inc;
    if (amount <= budget) onBid(amount);
  };

  const handleCustom = () => {
    const val = parseFloat(custom);
    if (!isNaN(val) && val > minNext && val <= budget) {
      onBid(val);
      setCustom("");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Place a Bid</p>

      <div className="grid grid-cols-5 gap-2">
        {INCREMENTS.map(({ label, value }) => {
          const next = minNext + value;
          const canBid = !disabled && next <= budget;
          return (
            <button
              key={label}
              onClick={() => handleIncrement(value)}
              disabled={!canBid}
              className={`py-2 rounded-xl text-sm font-semibold transition ${
                canBid
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          placeholder={`Custom bid (min ${fmt(minNext + 1)})`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={disabled}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
        />
        <button
          onClick={handleCustom}
          disabled={disabled || !custom}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white disabled:text-gray-400 px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          Bid
        </button>
      </div>
    </div>
  );
}
