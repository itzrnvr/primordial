import { useEffect, useRef } from "react";
import { useStore } from "../state/store.js";
import { linguaWorld, linguaState, linguaError, resetLingua } from "../sim/lingua-runtime.js";

function fmtParams(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

// Train vs honest (validation) loss over the organism's life.
function LossChart({ history }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const T = history.train, V = history.valid, S = history.steps;
    if (T.length < 2) return;
    let lo = Math.min(...T, ...V), hi = Math.max(...T, ...V);
    lo = Math.min(lo, 1.8); hi = Math.max(hi, 4.3);
    const span = hi - lo || 1;
    const draw = (series, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = (i / (series.length - 1)) * c.width;
        const y = c.height - ((series[i] - lo) / span) * (c.height - 6) - 3;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    draw(T, "#7cffb2");
    draw(V, "#ffb45e");
  });
  return <canvas ref={ref} width={300} height={64} className="loss-canvas" />;
}

export default function LinguaHUD() {
  useStore((s) => s.uiTick);
  if (linguaState !== "ready" || !linguaWorld) {
    return (
      <div className="hud lingua panel">
        <div className="title">ORGANISM<span className="sub">
          {linguaState === "error" ? "failed to load TinyStories: " + linguaError : "waking up - loading TinyStories..."}
        </span></div>
      </div>
    );
  }
  const st = linguaWorld.stats();
  return (
    <div className="hud lingua panel">
      <div className="title">ORGANISM<span className="sub">one creature learning language from scratch</span></div>

      <div className="status-line">
        age <b>{st.steps}</b> steps · <b>{fmtParams(st.params)}</b> params · sees <b>{st.K}</b> chars · brain <b>{st.H}</b> · grew <b>{st.growths}</b>x
      </div>

      <div className="lingua-loss">
        <div className="lingua-loss-row"><span>training loss</span><b className="c-green">{st.trainLoss.toFixed(3)}</b></div>
        <div className="lingua-loss-row" title="Measured on stories it NEVER trained on. This is the honest score."><span>honest score (unseen stories)</span><b className="c-orange">{st.validLoss.toFixed(3)}</b></div>
        <div className="lingua-loss-note">random guessing = 4.25 · lower is smarter · both lines falling = learning</div>
      </div>

      <LossChart history={linguaWorld.history} />

      <div className="lingua-sample-title">what it is saying right now</div>
      <div className="lingua-sample">{st.sample || "(it has not said anything yet)"}</div>

      <div className="buttons">
        <button onClick={() => linguaWorld.tryGrow()} title="Force it to grow right now, even if it has not plateaued.">force grow</button>
        <button onClick={() => resetLingua()} title="Start over from a newborn organism.">rebirth</button>
      </div>
    </div>
  );
}
