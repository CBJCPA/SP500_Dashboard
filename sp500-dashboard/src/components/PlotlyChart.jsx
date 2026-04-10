import { useRef, useEffect, memo } from 'react';
import Plotly from 'plotly.js/dist/plotly';

function PlotlyChart({ data, layout, config, style, useResizeHandler }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    Plotly.react(el, data, layout, config || { responsive: true, displayModeBar: false });

    return () => {
      Plotly.purge(el);
    };
  }, [data, layout, config]);

  useEffect(() => {
    if (!useResizeHandler) return;
    const el = containerRef.current;
    if (!el) return;

    const onResize = () => Plotly.Plots.resize(el);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [useResizeHandler]);

  return <div ref={containerRef} style={style} />;
}

export default memo(PlotlyChart);
