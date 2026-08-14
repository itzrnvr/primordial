import { useEffect, useRef } from "react";
import { useStore } from "../state/store.js";
import { evolveWorld, evolveState, evolveError, resetEvolve } from "../sim/evolve-runtime.js";

function fmtParams(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}
function lineageColor(id) {
  return "hsl(" + (((id || 1) * 137.508) % 360) + ",75%,60%)";
}

// best (green) and mean (grey) honest score per generation
function GenChart({ history }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (history.length < 2) {
      ctx.fillStyle = "#5a6c8c";
      ctx.font = "10px monospace";
      ctx.fillText("chart appears after 2 generations", 8, 36);
      return;
    }
    const B = history.map((h) => h.best);
    const M = history.map((h) => h.mean);
    const lo = Math.min(...B) - 0.05;
    const hi = Math.max(...M, 4.3);
    const span = hi - lo || 1;
    const draw = (series, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      series.forEach((v, i) => {
        const x = (i / (series.length - 1)) * (c.width - 8) + 4;
        const y = c.height - ((v - lo) / span) * (c.height - 8) - 4;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    };
    draw(M, "#5a6c8c");
    draw(B, "#7cffb2");
  });
  return <canvas ref={ref} width={300} height={64} className="loss-canvas" />;
}

export default function EvolveHUD() {
  useStore((s) => s.uiTick);
  if (evolveState !== "ready" || !evolveWorld) {
    return (
      <div className="hud lingua panel">
        <div className="title">EVOLUTION<span className="sub">
          {evolveState === "error" ? "failed to load TinyStories: " + evolveError : "waking up - loading TinyStories..."}
        </span></div>
      </div>
    );
  }
  const st = evolveWorld.stats();
  const be = st.bestEver;
  return (
    <div className="hud lingua panel">
      <div className="title">EVOLUTION<span className="sub">evolution discovers the architecture - gradient descent does the learning</span></div>

      <div className="status-line">
        generation <b>{st.gen}</b> · creatures scored <b>{st.done}/{st.total}</b> · lifetime budget <b>{st.stepsPerGen}</b> steps · archive <b>{st.archiveSize}</b> proven genomes
      </div>

      {be && (
        <div className="evo-best">
          <b className="c-green">best ever</b> (gen {be.gen}, #{be.id}): honest score <b>{be.valLoss.toFixed(3)}</b> with <b>{fmtParams(be.params)}</b> params
          <span className="tip">The honest score is average surprise per character on stories it NEVER trained on. Random guessing = 4.25. Lower = smarter.</span>
          <br />
          genome: memory K={be.genome.K} · code E={be.genome.E} · brain H={be.genome.H} · learn rate {be.genome.lr.toFixed(3)}
        </div>
      )}

      <table className="evo-table">
        <thead>
          <tr><th>#</th><th>creature</th><th>honest score</th><th>params</th><th>genome</th></tr>
        </thead>
        <tbody>
          {st.board.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td><span className="evo-dot" style={{ background: lineageColor(p.lineage) }} />#{p.id}</td>
              <td>{p.done ? p.valLoss.toFixed(3) : "learning " + p.step + "/" + st.stepsPerGen}</td>
              <td>{fmtParams(p.org.paramCount())}</td>
              <td>K{p.genome.K} E{p.genome.E} H{p.genome.H} lr{p.genome.lr.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <GenChart history={st.history} />

      <div className="lingua-sample-title">what the champion says</div>
      <div className="lingua-sample">{st.sample || "(no champion yet - the first generation is still alive)"}</div>

      <div className="evo-explain">
        Each row is one creature. Its genome is only 4 numbers: K = how many past characters it sees,
        E = size of each character's internal code, H = brain units, lr = how fast it learns.
        Evolution mutates and recombines these 4 numbers; it never touches the thousands of weights -
        gradient descent trains those during each creature's life. When a generation dies, the lowest
        honest scores breed the next one. Color = lineage (family). Height in the 3D view = how far
        above random guessing; size = parameter count.
      </div>

      <div className="buttons">
        <button onClick={() => resetEvolve()} title="Start over from a fresh random population.">reset evolution</button>
      </div>
    </div>
  );
}
