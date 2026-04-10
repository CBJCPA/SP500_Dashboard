import React, { useState } from "react";

function HelpModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl"
        style={{ backgroundColor: "#1e293b", border: "1px solid #374151" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
            Dashboard Help
          </h3>
          <button
            onClick={onClose}
            className="text-lg leading-none cursor-pointer"
            style={{ color: "#9ca3af" }}
            aria-label="Close help"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 text-sm" style={{ color: "#cbd5e1" }}>
          <p>
            <strong style={{ color: "#e2e8f0" }}>S&amp;P 500 Decline Backtesting Dashboard</strong>{" "}
            lets you analyze historical market declines against indicator signals.
          </p>
          <p>
            <strong style={{ color: "#93c5fd" }}>Date Range:</strong> Use the start
            and end date inputs to focus on a specific time period. The chart and
            all statistics will update to reflect the selected range.
          </p>
          <p>
            <strong style={{ color: "#93c5fd" }}>Decline Thresholds:</strong> Toggle
            5%, 10%, and 20% decline overlays on the chart to visualize drawdown
            periods.
          </p>
          <p>
            <strong style={{ color: "#93c5fd" }}>Indicators:</strong> Individual
            indicator performance is shown in the bottom panel, along with
            combination analysis (how many signals fire simultaneously) and
            decline duration statistics.
          </p>
          <p>
            <strong style={{ color: "#93c5fd" }}>Export:</strong> Click the export
            button to download the current dataset as a file for further analysis.
          </p>
        </div>
      </div>
    </div>
  );
}

function DateRangeSelector({
  startDate = "",
  endDate = "",
  minDate = "",
  maxDate = "",
  onStartDateChange,
  onEndDateChange,
  onExport,
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div
        className="w-full flex flex-wrap items-center gap-4 px-4 py-3"
        style={{ backgroundColor: "#0d0f1a" }}
      >
        {/* Title */}
        <h1
          className="text-lg font-bold mr-auto whitespace-nowrap"
          style={{ color: "#e2e8f0" }}
        >
          S&amp;P 500 Decline Backtesting Dashboard
        </h1>

        {/* Date inputs */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            Start
            <input
              type="date"
              value={startDate}
              min={minDate}
              max={endDate || maxDate}
              onChange={(e) => onStartDateChange?.(e.target.value)}
              className="rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #374151",
                color: "#e2e8f0",
              }}
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            End
            <input
              type="date"
              value={endDate}
              min={startDate || minDate}
              max={maxDate}
              onChange={(e) => onEndDateChange?.(e.target.value)}
              className="rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #374151",
                color: "#e2e8f0",
              }}
            />
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
            style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
          >
            <span>⬇</span>
            Export
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center rounded w-7 h-7 text-sm font-bold cursor-pointer transition-colors"
            style={{ backgroundColor: "#374151", color: "#9ca3af" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4b5563")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#374151")}
            aria-label="Help"
          >
            ?
          </button>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

export default DateRangeSelector;
