import React from "react";

const colorForValue = (value) => {
  if (value > 0.6) return "#4ade80";
  if (value >= 0.3) return "#facc15";
  return "#f87171";
};

const formatNum = (v) => {
  if (v == null || Number.isNaN(v)) return "—";
  return typeof v === "number" ? v.toFixed(3) : v;
};

const SectionTitle = ({ children }) => (
  <h3
    className="text-xs font-semibold uppercase tracking-wider mb-2"
    style={{ color: "#94a3b8" }}
  >
    {children}
  </h3>
);

const TH = ({ children, className = "" }) => (
  <th
    className={`px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wider ${className}`}
    style={{ color: "#94a3b8", backgroundColor: "#1e293b" }}
  >
    {children}
  </th>
);

const TD = ({ children, color, className = "" }) => (
  <td
    className={`px-3 py-1.5 text-xs ${className}`}
    style={{ color: color || "#e2e8f0" }}
  >
    {children}
  </td>
);

function StatsPanel({
  individualStats = [],
  combinationStats = [],
  declineDurations = {},
  activeDeclineThreshold = 10,
}) {
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#151829",
      }}
    >
      {/* Three-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-3">
        {/* Individual Indicator Stats */}
        <div>
          <SectionTitle>Individual Indicator Stats</SectionTitle>
          <div
            className="overflow-auto rounded"
            style={{ border: "1px solid #2d3748" }}
          >
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH>Indicator</TH>
                  <TH>TP</TH>
                  <TH>FP</TH>
                  <TH>FN</TH>
                  <TH>Precision</TH>
                  <TH>Recall</TH>
                </tr>
              </thead>
              <tbody>
                {individualStats.map((row, i) => (
                  <tr
                    key={row.name}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#151829" : "#1a1f35",
                    }}
                  >
                    <TD>{row.name}</TD>
                    <TD>{row.tp}</TD>
                    <TD>{row.fp}</TD>
                    <TD>{row.fn}</TD>
                    <TD color={colorForValue(row.precision)}>
                      {formatNum(row.precision)}
                    </TD>
                    <TD color={colorForValue(row.recall)}>
                      {formatNum(row.recall)}
                    </TD>
                  </tr>
                ))}
                {individualStats.length === 0 && (
                  <tr style={{ backgroundColor: "#151829" }}>
                    <TD className="text-center" colSpan={6}>
                      No data
                    </TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Combined Signal Analysis */}
        <div>
          <SectionTitle>Combined Signal Analysis</SectionTitle>
          <div
            className="overflow-auto rounded"
            style={{ border: "1px solid #2d3748" }}
          >
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH>Min Signals</TH>
                  <TH>TP</TH>
                  <TH>FP</TH>
                  <TH>FN</TH>
                  <TH>Precision</TH>
                  <TH>Recall</TH>
                </tr>
              </thead>
              <tbody>
                {combinationStats.map((row, i) => (
                  <tr
                    key={row.minFiring}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#151829" : "#1a1f35",
                    }}
                  >
                    <TD>{row.label}</TD>
                    <TD>{row.tp}</TD>
                    <TD>{row.fp}</TD>
                    <TD>{row.fn}</TD>
                    <TD color={colorForValue(row.precision)}>
                      {formatNum(row.precision)}
                    </TD>
                    <TD color={colorForValue(row.recall)}>
                      {formatNum(row.recall)}
                    </TD>
                  </tr>
                ))}
                {combinationStats.length === 0 && (
                  <tr style={{ backgroundColor: "#151829" }}>
                    <TD className="text-center" colSpan={6}>
                      No data
                    </TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decline Duration Analysis */}
        <div>
          <SectionTitle>Decline Duration Analysis</SectionTitle>
          <div
            className="overflow-auto rounded"
            style={{ border: "1px solid #2d3748" }}
          >
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH>Threshold</TH>
                  <TH>Count</TH>
                  <TH>Avg Days</TH>
                  <TH>Median</TH>
                  <TH>Min</TH>
                  <TH>Max</TH>
                  <TH>Std Dev</TH>
                </tr>
              </thead>
              <tbody>
                {["5", "10", "20"].map((key, i) => {
                  const d = declineDurations[key];
                  return (
                    <tr
                      key={key}
                      style={{
                        backgroundColor: i % 2 === 0 ? "#151829" : "#1a1f35",
                      }}
                    >
                      <TD>{key}%</TD>
                      <TD>{d ? d.count : "—"}</TD>
                      <TD>{d ? formatNum(d.avg) : "—"}</TD>
                      <TD>{d ? formatNum(d.median) : "—"}</TD>
                      <TD>{d ? d.min : "—"}</TD>
                      <TD>{d ? d.max : "—"}</TD>
                      <TD>{d ? formatNum(d.std) : "—"}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsPanel;
