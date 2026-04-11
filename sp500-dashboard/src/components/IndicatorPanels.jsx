import React, { useMemo, useState } from "react";
import Plot from "./PlotlyChart";

const INDICATOR_META = {
  hy_spread: {
    label: "HY Credit Spreads",
    unit: "%",
    min: 2.0,
    max: 12.0,
    step: 0.1,
    defaultThreshold: 5.0,
    direction: "above",
    color: "#f59e0b",
    tooltip:
      "High yield credit spreads measure the risk premium investors demand. Widening spreads (above threshold) signal credit stress and potential equity declines.",
  },
  yield_curve: {
    label: "Yield Curve (10Y-2Y)",
    unit: "%",
    min: -2.0,
    max: 3.0,
    step: 0.05,
    defaultThreshold: 0.0,
    direction: "below",
    color: "#3b82f6",
    tooltip:
      "The 10Y-2Y spread measures the yield curve slope. Inversion (below threshold) has historically preceded recessions and market declines.",
  },
  breadth: {
    label: "Advance-Decline Breadth",
    unit: "%",
    min: 5,
    max: 95,
    step: 1,
    defaultThreshold: 40,
    direction: "below",
    color: "#10b981",
    tooltip:
      "Advance-decline breadth shows what percentage of stocks participate in the trend. Low breadth (below threshold) suggests narrow, fragile rallies.",
  },
  vix: {
    label: "VIX Level",
    unit: "",
    min: 10,
    max: 80,
    step: 1,
    defaultThreshold: 25,
    direction: "above",
    color: "#ef4444",
    tooltip:
      "The VIX measures implied volatility (market fear). Elevated VIX (above threshold) signals heightened uncertainty and potential for sharp declines.",
  },
  put_call: {
    label: "Put-Call Ratio",
    unit: "",
    min: 0.3,
    max: 2.0,
    step: 0.01,
    defaultThreshold: 1.0,
    direction: "above",
    color: "#a855f7",
    tooltip:
      "The put-call ratio measures hedging demand. High ratios (above threshold) indicate excessive fear, often preceding or during declines.",
  },
};

const INDICATOR_ORDER = ["hy_spread", "yield_curve", "breadth", "vix", "put_call"];

const DATA_KEYS = {
  hy_spread: "hy_spread",
  yield_curve: "yield_curve",
  breadth: "breadth",
  vix: "vix",
  put_call: "put_call",
};

function formatThresholdLabel(value, unit) {
  if (unit === "bps") return `${value} bps`;
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "") {
    if (Number.isInteger(value)) return `${value}`;
    return `${value.toFixed(2)}`;
  }
  return `${value} ${unit}`;
}

function HelpTooltip({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-block", marginLeft: 6 }}
    >
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid #475569",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          userSelect: "none",
          lineHeight: 1,
        }}
      >
        ?
      </span>
      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 260,
            padding: "10px 12px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#cbd5e1",
            fontSize: 12,
            lineHeight: 1.5,
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

function buildSignalShapes(dates, signals, direction, startIdx, endIdx) {
  const shapes = [];
  if (!signals || signals.length === 0) return shapes;

  const bearishColor = "rgba(248, 113, 113, 0.15)";
  const bullishColor = "rgba(74, 222, 128, 0.1)";

  let inSignal = false;
  let signalStart = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const active = !!signals[i];
    if (active && !inSignal) {
      inSignal = true;
      signalStart = dates[i];
    } else if ((!active || i === endIdx) && inSignal) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: signalStart,
        x1: dates[active && i === endIdx ? i : i - 1],
        y0: 0,
        y1: 1,
        fillcolor: bearishColor,
        line: { width: 0 },
        layer: "below",
      });
      inSignal = false;
      signalStart = null;
    }

    const bullish = !active;
    if (bullish && i > startIdx && !signals[i] && signals[i - 1]) {
      // Transition from signal to no-signal handled above
    }
  }

  // Also shade bullish regions (where signal is NOT firing)
  inSignal = false;
  signalStart = null;
  for (let i = startIdx; i <= endIdx; i++) {
    const notFiring = !signals[i];
    if (notFiring && !inSignal) {
      inSignal = true;
      signalStart = dates[i];
    } else if ((!notFiring || i === endIdx) && inSignal) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: signalStart,
        x1: dates[notFiring && i === endIdx ? i : i - 1],
        y0: 0,
        y1: 1,
        fillcolor: bullishColor,
        line: { width: 0 },
        layer: "below",
      });
      inSignal = false;
      signalStart = null;
    }
  }

  return shapes;
}

function IndicatorPanel({
  indicatorId,
  indicator,
  data,
  dateRange,
  signals,
  onIndicatorChange,
  crosshairDate,
  onHover,
  onUnhover,
  presets,
  onApplyPreset,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = INDICATOR_META[indicatorId];
  const { startIdx, endIdx } = dateRange;
  const dates = data.dates;
  const dataKey = DATA_KEYS[indicatorId];
  const values = data[dataKey];

  const slicedDates = useMemo(
    () => dates.slice(startIdx, endIdx + 1),
    [dates, startIdx, endIdx]
  );

  const slicedValues = useMemo(
    () => (values ? values.slice(startIdx, endIdx + 1) : []),
    [values, startIdx, endIdx]
  );

  const signalShapes = useMemo(
    () =>
      buildSignalShapes(
        dates,
        signals,
        meta.direction,
        startIdx,
        endIdx
      ),
    [dates, signals, meta.direction, startIdx, endIdx]
  );

  const thresholdLine = {
    type: "line",
    xref: "paper",
    yref: "y",
    x0: 0,
    x1: 1,
    y0: indicator.threshold,
    y1: indicator.threshold,
    line: { color: "#f97316", width: 1.5, dash: "dash" },
    layer: "above",
  };

  const traceData = [
    {
      x: slicedDates,
      y: slicedValues,
      type: "scatter",
      mode: "lines",
      name: meta.label,
      line: { color: meta.color, width: 1.5 },
      hoverinfo: "x+y",
      hoverlabel: {
        bgcolor: "#1e293b",
        bordercolor: "#475569",
        font: { color: "#e2e8f0", size: 11 },
      },
    },
  ];

  const layout = {
    plot_bgcolor: "#0f1117",
    paper_bgcolor: "#151829",
    font: { color: "#e2e8f0", size: 11 },
    height: 200,
    margin: { l: 60, r: 30, t: 8, b: 30 },
    xaxis: {
      gridcolor: "#1e293b",
      linecolor: "#1e293b",
      zeroline: false,
      tickfont: { size: 9, color: "#64748b" },
      range: [dates[startIdx], dates[endIdx]],
    },
    yaxis: {
      gridcolor: "#1e293b",
      linecolor: "#1e293b",
      zeroline: false,
      tickfont: { size: 9, color: "#64748b" },
    },
    shapes: [...signalShapes, thresholdLine],
    hovermode: "x unified",
    showlegend: false,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  const unitLabel =
    meta.unit === "bps"
      ? " bps"
      : meta.unit === "%"
      ? "%"
      : meta.unit === "ratio"
      ? ""
      : "";

  return (
    <div
      style={{
        background: "#151829",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* Header - clickable to collapse */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: collapsed ? 0 : 8,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: 12,
            marginRight: 8,
            flexShrink: 0,
          }}
        >
          {collapsed ? "▶" : "▼"}
        </span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: meta.color,
            display: "inline-block",
            marginRight: 8,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "#e2e8f0",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {meta.label}
        </span>
        <HelpTooltip text={meta.tooltip} />
        {/* Preset buttons */}
        <div
          style={{ marginLeft: 12, display: "flex", gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {[5, 10, 20].map((pct) => {
            const p = presets?.[pct];
            return (
              <button
                key={pct}
                onClick={() => onApplyPreset?.(indicatorId, pct)}
                title={p ? `Threshold: ${formatThresholdLabel(p.threshold, meta.unit)}, Lag: ${p.lag}d, F1: ${(p.f1 * 100).toFixed(0)}%` : "Computing..."}
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: pct === 5 ? "#60a5fa" : pct === 10 ? "#fb923c" : "#ef4444",
                  cursor: "pointer",
                }}
              >
                {pct}%
              </button>
            );
          })}
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#64748b",
          }}
        >
          {collapsed ? `Threshold: ${formatThresholdLabel(indicator.threshold, meta.unit)} | Lag: ${indicator.lag}d` : (meta.direction === "above" ? "Higher = bearish" : "Lower = bearish")}
        </span>
      </div>

      {/* Chart - collapsible */}
      {!collapsed && (
      <>
      <Plot
        data={traceData}
        layout={layout}
        config={config}
        style={{ width: "100%", height: "200px" }}
        crosshairDate={crosshairDate}
        onHover={onHover}
        onUnhover={onUnhover}
      />

      {/* Threshold Slider */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <label
            style={{
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Threshold
          </label>
          <span
            style={{
              color: "#e2e8f0",
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatThresholdLabel(indicator.threshold, meta.unit)}
          </span>
        </div>
        <input
          type="range"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={indicator.threshold}
          onChange={(e) =>
            onIndicatorChange(indicatorId, "threshold", parseFloat(e.target.value))
          }
          style={{
            width: "100%",
            height: 6,
            accentColor: meta.color,
            cursor: "pointer",
          }}
          className="indicator-slider"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#475569",
            marginTop: 2,
          }}
        >
          <span>{formatThresholdLabel(meta.min, meta.unit)}</span>
          <span>{formatThresholdLabel(meta.max, meta.unit)}</span>
        </div>
      </div>

      {/* Lag Slider */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <label
            style={{
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Lag
          </label>
          <span
            style={{
              color: "#e2e8f0",
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {indicator.lag} days
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={indicator.lag}
          onChange={(e) =>
            onIndicatorChange(indicatorId, "lag", parseInt(e.target.value, 10))
          }
          style={{
            width: "100%",
            height: 6,
            accentColor: meta.color,
            cursor: "pointer",
          }}
          className="indicator-slider"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#475569",
            marginTop: 2,
          }}
        >
          <span>0 days</span>
          <span>60 days</span>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function IndicatorPanels({
  data,
  dateRange,
  indicators,
  onIndicatorChange,
  signals,
  crosshairDate,
  onHover,
  onUnhover,
  optimalPresets,
  onApplyPreset,
}) {
  const indicatorMap = useMemo(() => {
    const map = {};
    if (indicators) {
      for (const ind of indicators) {
        map[ind.id] = ind;
      }
    }
    return map;
  }, [indicators]);

  return (
    <div className="grid grid-cols-1 gap-4">
      {INDICATOR_ORDER.map((id) => {
        const indicator = indicatorMap[id];
        if (!indicator) return null;
        return (
          <IndicatorPanel
            key={id}
            indicatorId={id}
            indicator={indicator}
            data={data}
            dateRange={dateRange}
            signals={signals?.[id]}
            onIndicatorChange={onIndicatorChange}
            crosshairDate={crosshairDate}
            onHover={onHover}
            onUnhover={onUnhover}
            presets={optimalPresets?.[id]}
            onApplyPreset={onApplyPreset}
          />
        );
      })}
    </div>
  );
}

export default React.memo(IndicatorPanels);
