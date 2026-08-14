import { useEffect, useRef } from "react";
import { world } from "../sim/world.js";

// Tiny canvas sparklines drawn from the world's history buffers.
function drawSeries(ctx, w, h, series, color, min, max) {
  if (!series || series.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const span = max - min || 1;
  for (let i = 0; i < series.length; i++) {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((series[i] - min) / span) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function Spark({ data, color, min, max, height = 34, label, value }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.width, h = c.height;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    drawSeries(ctx, w, h, data, color, min, max);
  });
  return (
    <div className="chart">
      <div className="chart-label">
        <span>{label}</span>
        <span className="chart-value">{value}</span>
      </div>
      <canvas ref={ref} width={190} height={height} />
    </div>
  );
}

// The adaptation chart: average metabolism (what the population IS)
// vs the drifting optimum (what the environment WANTS). Watching
// the cyan line chase the orange line is watching evolution happen.
export function AdaptChart({ height = 46 }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.width, h = c.height;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const H = world.history;
    drawSeries(ctx, w, h, H.metabolism, "#6ee7ff", 0, 1);
    drawSeries(ctx, w, h, H.optimum, "#ffb45e", 0, 1);
  });
  return (
    <div className="chart">
      <div className="chart-label">
        <span>adaptation</span>
        <span className="chart-value">
          <i className="dot cyan" /> avg gene <i className="dot orange" /> env optimum
        </span>
      </div>
      <canvas ref={ref} width={190} height={height} />
    </div>
  );
}
