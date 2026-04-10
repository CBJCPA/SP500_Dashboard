import { useState, useEffect, useMemo, useCallback } from 'react';
import SPXChart from './components/SPXChart';
import IndicatorPanels from './components/IndicatorPanels';
import StatsPanel from './components/StatsPanel';
import DateRangeSelector from './components/DateRangeSelector';
import {
  identifyDeclinePeriods,
  calculateDeclineDurations,
  indicatorSignal,
  calculateStats,
  calculateCombinationStats,
  getDateRange,
} from './utils/calculations';

const DEFAULT_INDICATORS = [
  {
    id: 'hy_spread',
    name: 'HY Credit Spreads',
    dataKey: 'hy_spread',
    threshold: 5.0,
    lag: 0,
    direction: 'above',
    unit: '%',
    min: 2.0,
    max: 12.0,
    step: 0.1,
  },
  {
    id: 'yield_curve',
    name: 'Yield Curve (10Y-2Y)',
    dataKey: 'yield_curve',
    threshold: 0.0,
    lag: 0,
    direction: 'below',
    unit: '%',
    min: -2.0,
    max: 3.0,
    step: 0.05,
  },
  {
    id: 'breadth',
    name: 'Advance-Decline Breadth',
    dataKey: 'breadth',
    threshold: 40,
    lag: 0,
    direction: 'below',
    unit: '%',
    min: 5,
    max: 95,
    step: 1,
  },
  {
    id: 'vix',
    name: 'VIX Level',
    dataKey: 'vix',
    threshold: 25,
    lag: 0,
    direction: 'above',
    unit: '',
    min: 10,
    max: 80,
    step: 1,
  },
  {
    id: 'put_call',
    name: 'Put-Call Ratio',
    dataKey: 'put_call',
    threshold: 1.0,
    lag: 0,
    direction: 'above',
    unit: '',
    min: 0.3,
    max: 2.0,
    step: 0.01,
  },
];

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [activeThresholds, setActiveThresholds] = useState({
    5: true,
    10: true,
    20: true,
  });
  const [startDate, setStartDate] = useState('2010-01-04');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [selectedDeclineForStats, setSelectedDeclineForStats] = useState(5);

  // Load data
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/market_data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        if (d.dates && d.dates.length > 0) {
          setStartDate(d.dates[0]);
          setEndDate(d.dates[d.dates.length - 1]);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Date range indices
  const dateRange = useMemo(() => {
    if (!data) return { startIdx: 0, endIdx: 0 };
    return getDateRange(data.dates, startDate, endDate);
  }, [data, startDate, endDate]);

  // Decline zones
  const declineZones = useMemo(() => {
    if (!data) return {};
    return {
      5: identifyDeclinePeriods(data.spx_close, 5),
      10: identifyDeclinePeriods(data.spx_close, 10),
      20: identifyDeclinePeriods(data.spx_close, 20),
    };
  }, [data]);

  // Indicator signals
  const signals = useMemo(() => {
    if (!data) return {};
    const result = {};
    for (const ind of indicators) {
      const values = data[ind.dataKey];
      if (!values) continue;
      result[ind.id] = indicatorSignal(values, ind.threshold, ind.direction, ind.lag);
    }
    return result;
  }, [data, indicators]);

  // Individual stats
  const individualStats = useMemo(() => {
    if (!data || !declineZones[selectedDeclineForStats]) return [];
    const actual = declineZones[selectedDeclineForStats];
    return indicators.map((ind) => {
      const signal = signals[ind.id];
      if (!signal) return { name: ind.name, tp: 0, fp: 0, fn: 0, tn: 0, precision: 0, recall: 0 };
      const stats = calculateStats(signal, actual, dateRange.startIdx, dateRange.endIdx);
      return { name: ind.name, ...stats };
    });
  }, [data, indicators, signals, declineZones, selectedDeclineForStats, dateRange]);

  // Combination stats
  const combinationStats = useMemo(() => {
    if (!data || !declineZones[selectedDeclineForStats]) return [];
    const actual = declineZones[selectedDeclineForStats];
    const signalArrays = indicators.map((ind) => signals[ind.id] || new Array(data.dates.length).fill(false));
    return calculateCombinationStats(signalArrays, actual, dateRange.startIdx, dateRange.endIdx);
  }, [data, indicators, signals, declineZones, selectedDeclineForStats, dateRange]);

  // Decline durations
  const declineDurations = useMemo(() => {
    if (!data) return {};
    const rangedPrices = data.spx_close.slice(dateRange.startIdx, dateRange.endIdx + 1);
    return {
      5: calculateDeclineDurations(rangedPrices, 5),
      10: calculateDeclineDurations(rangedPrices, 10),
      20: calculateDeclineDurations(rangedPrices, 20),
    };
  }, [data, dateRange]);

  // Handlers
  const handleIndicatorChange = useCallback((id, field, value) => {
    setIndicators((prev) =>
      prev.map((ind) => (ind.id === id ? { ...ind, [field]: Number(value) } : ind))
    );
  }, []);

  const handleThresholdToggle = useCallback((threshold) => {
    setActiveThresholds((prev) => ({
      ...prev,
      [threshold]: !prev[threshold],
    }));
  }, []);

  const handleExport = useCallback(() => {
    if (!data) return;

    // Build filtered dataset
    const exportData = {
      config: {
        startDate,
        endDate,
        selectedDeclineThreshold: selectedDeclineForStats,
        activeThresholds,
        indicators: indicators.map((ind) => ({
          id: ind.id,
          name: ind.name,
          threshold: ind.threshold,
          lag: ind.lag,
          direction: ind.direction,
        })),
      },
      signalDates: [],
    };

    // Find dates where any signal fired
    for (let i = dateRange.startIdx; i <= dateRange.endIdx; i++) {
      const firedSignals = indicators.filter((ind) => signals[ind.id]?.[i]);
      if (firedSignals.length > 0) {
        exportData.signalDates.push({
          date: data.dates[i],
          spx: data.spx_close[i],
          signals: firedSignals.map((ind) => ind.name),
          inDecline: {
            '5pct': declineZones[5]?.[i] || false,
            '10pct': declineZones[10]?.[i] || false,
            '20pct': declineZones[20]?.[i] || false,
          },
        });
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sp500_backtest_${startDate}_to_${endDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, startDate, endDate, selectedDeclineForStats, activeThresholds, indicators, signals, declineZones, dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-lg">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center bg-[#151829] p-8 rounded-lg border border-red-800">
          <p className="text-red-400 text-lg mb-2">Failed to load data</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <p className="text-slate-500 text-sm mt-2">
            Run <code className="bg-[#1e293b] px-2 py-1 rounded">python3 generate_data.py</code> to create the data file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      {/* Header */}
      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        minDate={data.dates[0]}
        maxDate={data.dates[data.dates.length - 1]}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onExport={handleExport}
      />

      {/* Main Content */}
      <div className="px-4 pb-64">
        {/* SPX Price Chart */}
        <SPXChart
          data={data}
          declineZones={declineZones}
          activeThresholds={activeThresholds}
          dateRange={dateRange}
          onThresholdToggle={handleThresholdToggle}
        />

        {/* Decline Threshold Selector for Stats */}
        <div className="flex items-center justify-center gap-4 my-4">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Stats for decline threshold:</span>
          {[5, 10, 20].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedDeclineForStats(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                selectedDeclineForStats === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1e293b] text-slate-400 hover:bg-[#2d3748]'
              }`}
            >
              {t}%
            </button>
          ))}
        </div>

        {/* Indicator Panels */}
        <IndicatorPanels
          data={data}
          dateRange={dateRange}
          indicators={indicators}
          onIndicatorChange={handleIndicatorChange}
          signals={signals}
        />
      </div>

      {/* Sticky Stats Panel */}
      <StatsPanel
        individualStats={individualStats}
        combinationStats={combinationStats}
        declineDurations={declineDurations}
        activeDeclineThreshold={selectedDeclineForStats}
      />
    </div>
  );
}

export default App;
