import { useRef, useEffect, useState, memo } from 'react';

let Plotly = null;
let plotlyLoadPromise = null;

function loadPlotly() {
  if (plotlyLoadPromise) return plotlyLoadPromise;
  plotlyLoadPromise = import('plotly.js/dist/plotly').then(mod => {
    Plotly = mod.default || mod;
    return Plotly;
  });
  return plotlyLoadPromise;
}

function PlotlyChart({ data, layout, config, style }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(!!Plotly);

  useEffect(() => {
    if (!Plotly) {
      loadPlotly()
        .then(() => setReady(true))
        .catch(err => setError('Failed to load Plotly: ' + err.message));
    }
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    try {
      Plotly.react(
        containerRef.current,
        data || [],
        layout || {},
        config || { responsive: true, displayModeBar: false }
      );
    } catch (err) {
      setError('Plotly render error: ' + err.message);
    }
    return () => {
      try { Plotly.purge(containerRef.current); } catch (_) {}
    };
  }, [data, layout, config, ready]);

  if (error) {
    return (
      <div style={{ ...style, background: '#1a1020', border: '1px solid #ef4444', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 13, padding: 12 }}>
        {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ ...style, background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
        Loading chart...
      </div>
    );
  }

  return <div ref={containerRef} style={style} />;
}

export default memo(PlotlyChart);
