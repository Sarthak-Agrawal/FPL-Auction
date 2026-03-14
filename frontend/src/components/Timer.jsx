export default function Timer({ seconds, duration = 30 }) {
  const pct = duration > 0 ? Math.min((seconds / duration) * 100, 100) : 0;
  const isUrgent = seconds <= 5;
  const isWarning = seconds <= 10 && seconds > 5;
  const barColor = isUrgent ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-green-500";

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Time Remaining</span>
        <span className={`text-3xl font-bold ${isUrgent ? "text-red-600 animate-pulse" : "text-gray-800"}`}>
          {seconds}s
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${barColor} h-3 rounded-full transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
