import React, { useMemo } from "react";
import Plot from "react-plotly.js";

const THRESHOLD_CONFIG = {
  5: { label: "5% Decline", color: "rgba(96, 165, 250, 0.15)", borderColor: "#60a5fa" },
  10: { label: "10% Decline", color: "rgba(251, 146, 60, 0.15)", borderColor: "#fb923c" },
  20: { label: "20% Decline", color: "rgba(239, 68, 68, 0.2)", borderColor: "#ef4444" },
};

function buildShapes(dates, declineZones, activeThresholds, startIdx, endIdx) {
  const shapes = [];

  for (const key of [5, 10, 20]) {
    if (!activeThresholds[key]) continue;
    const zone = declineZones[key];
    if (!zone) continue;

    const { color } = THRESHOLD_CONFIG[key];
    let inZone = false;
    let zoneStart = null;

    for (let i = startIdx; i <= endIdx; i++) {
      if (zone[i] && !inZone) {
        inZone = true;
        zoneStart = dates[i];
      } else if ((!zone[i] || i === endIdx) && inZone) {
        shapes.push({
          type: "rect",
          xref: "x",
          yref: "paper",
          x0: zoneStart,
          x1: dates[zone[i] && i === endIdx ? i : i - 1],
          y0: 0,
          y1: 1,
          fillcolor: color,
          line: { width: 0 },
          layer: "below",
        });
        inZone = false;
        zoneStart = null;
      }
    }
  }

  return shapes;
}

function buildHoverText(dates, spxClose, declineZones, activeThresholds, startIdx, endIdx) {
  const texts = [];
  for (let i = startIdx; i <= endIdx; i++) {
    let text = `Date: ${dates[i]}<br>Price: ${spxClose[i]?.toFixed(2)}`;
    for (const key of [5, 10, 20]) {
      if (!activeThresholds[key]) continue;
      const active = declineZones[key]?.[i];
      text += `<br>${key}% Decline: ${active ? "Yes" : "No"}`;
    }
    texts.push(text);
  }
  return texts;
}

function SPXChart({ data, declineZones, activeThresholds, dateRange, onThresholdToggle }) {
  const { startIdx, endIdx } = dateRange;
  const dates = data.dates;
  const spxClose = data.spx_close;

  const slicedDates = useMemo(
    () => dates.slice(startIdx, endIdx + 1),
    [dates, startIdx, endIdx]
  );
  const slicedClose = useMemo(
    () => spxClose.slice(startIdx, endIdx + 1),
    [spxClose, startIdx, endIdx]
  );

  const shapes = useMemo(
    () => buildShapes(dates, declineZones, activeThresholds, startIdx, endIdx),
    [dates, declineZones, activeThresholds, startIdx, endIdx]
  );

  const hoverText = useMemo(
    () => buildHoverText(dates, spxClose, declineZones, activeThresholds, startIdx, endIdx),
    [dates, spxClose, declineZones, activeThresholds, startIdx, endIdx]
  );

  const traceData = [
    {
      x: slicedDates,
      y: slicedClose,
      type: "scatter",
      mode: "lines",
      name: "SPX Close",
      line: { color: "#818cf8", width: 1.5 },
      text: hoverText,
      hoverinfo: "text",
      hoverlabel: {
        bgcolor: "#1e293b",
        bordercolor: "#475569",
        font: { color: "#e2e8f0", size: 12 },
      },
    },
  ];

  const layout = {
    title: {
      text: "S&P 500 Price with Decline Zones",
      font: { color: "#e2e8f0", size: 16 },
    },
    plot_bgcolor: "#0f1117",
    paper_bgcolor: "#0f1117",
    font: { color: "#e2e8f0" },
    height: 450,
    margin: { l: 60, r: 30, t: 50, b: 50 },
    xaxis: {
      gridcolor: "#1e293b",
      linecolor: "#1e293b",
      zeroline: false,
      title: { text: "Date", font: { color: "#94a3b8" } },
    },
    yaxis: {
      gridcolor: "#1e293b",
      linecolor: "#1e293b",
      zeroline: false,
      title: { text: "Price", font: { color: "#94a3b8" } },
    },
    shapes,
    hovermode: "x unified",
    showlegend: false,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          justifyContent: "flex-end",
        }}
      >
        {[5, 10, 20].map((threshold) => {
          const cfg = THRESHOLD_CONFIG[threshold];
          const isActive = activeThresholds[threshold];
          return (
            <button
              key={threshold}
              onClick={() => onThresholdToggle?.(threshold)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: `1px solid ${isActive ? cfg.borderColor : "#334155"}`,
                backgroundColor: isActive ? cfg.color : "transparent",
                color: isActive ? cfg.borderColor : "#64748b",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: isActive ? cfg.borderColor : "#334155",
                  display: "inline-block",
                }}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>
      <Plot
        data={traceData}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: "100%", height: "450px" }}
      />
    </div>
  );
}

export default React.memo(SPXChart);
