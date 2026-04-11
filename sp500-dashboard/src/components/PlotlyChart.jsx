import { useRef, useEffect, useState, useCallback, memo } from 'react';

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

function PlotlyChart({ data, layout, config, style, onHover, onUnhover, crosshairDate }) {
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

  // Build layout with crosshair and disabled zoom
  const fullLayout = {
    ...layout,
    dragmode: false,
    shapes: [
      ...(layout?.shapes || []),
      ...(crosshairDate ? [{
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: crosshairDate,
        x1: crosshairDate,
        y0: 0,
        y1: 1,
        line: { color: '#6b7280', width: 1, dash: 'dot' },
        layer: 'above',
      }] : []),
    ],
  };

  const fullConfig = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: false,
    doubleClick: false,
    ...(config || {}),
  };

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const el = containerRef.current;
    try {
      Plotly.react(el, data || [], fullLayout, fullConfig);
    } catch (err) {
      setError('Plotly render error: ' + err.message);
    }

    // Attach hover listeners
    if (onHover) {
      el.on('plotly_hover', (eventData) => {
        if (eventData?.points?.[0]?.x) {
          onHover(eventData.points[0].x);
        }
      });
    }
    if (onUnhover) {
      el.on('plotly_unhover', () => onUnhover());
    }

    return () => {
      try {
        el.removeAllListeners?.('plotly_hover');
        el.removeAllListeners?.('plotly_unhover');
        Plotly.purge(el);
      } catch (_) {}
    };
  }, [data, fullLayout, fullConfig, ready]);

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
