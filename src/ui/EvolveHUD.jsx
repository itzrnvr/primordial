import { useEffect, useRef } from "react";
import { useStore } from "../state/store.js";
import { evolveWorld, evolveState, evolveError, resetEvolve } from "../sim/evolve-runtime.js";

function fmtParams(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}
function lineageColor(id) {
  return "hsl(" + (((id || 1) * 137.508) % 360) + ",75%,60%)";
}

// champion (green, never worsens) and population mean (grey)
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
        gen <b>{st.gen}</b> · scored <b>{st.done}/{st.total}</b> · champion score <b>{st.bestEver ? st.bestEver.valLoss.toFixed(3) : "pending"}</b> · archive <b>{st.archiveSize}</b>
      </div>

      {be && (
        <div className="evo-best" title="The honest score is the average surprise per character on stories it NEVER trained on. Random guessing = 4.25. Lower = smarter.">
          <b className="c-green">best ever</b> gen {be.championGen ?? st.gen} #{be.id}: <b>{be.valLoss.toFixed(3)}</b> · {fmtParams(be.org.paramCount())} params
          <br />
          genome K={be.genome.K} E={be.genome.E} H={be.genome.H} lr={be.genome.lr.toFixed(3)}
        </div>
      )}

      <table className="evo-table">
        <thead>
          <tr><th>creature</th><th title="Honest score on unseen stories, shown when a life ends. Lower is better; random guessing = 4.25. While training you see % of the life completed.">score</th><th>size</th><th>genome</th></tr>
        </thead>
        <tbody>
          {st.board.map((p) => (
            <tr key={p.id} title={"creature #" + p.id + " - learn rate " + p.genome.lr.toFixed(3) + (p.done ? " - honest score " + p.valLoss.toFixed(3) : " - still training")}>
              <td>
                <span className="evo-dot" style={{ background: lineageColor(p.lineage) }} />
                {p.champion ? <b className="c-green">champ</b> : "#" + p.id}
              </td>
              <td>{p.done ? p.valLoss.toFixed(3) : <span className="evo-training" title={"training progress: " + p.step + " of " + st.stepsPerGen + " steps - the real score appears when its life ends"}>{Math.round((100 * p.step) / st.stepsPerGen)}%</span>}</td>
              <td>{fmtParams(p.org.paramCount())}</td>
              <td>K{p.genome.K} E{p.genome.E} H{p.genome.H}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <GenChart history={st.history} />

      <div className="lingua-sample-title">what the champion says</div>
      <div className="lingua-sample">{st.sample || "(no champion yet - the first generation is still alive)"}</div>

      <div className="evo-explain">
        Genome = 4 numbers only: K memory, E code size, H brain width, lr learn rate.
        Evolution mutates those; gradient descent trains the weights inside each life.
        The reigning champion survives with its trained weights. A child must beat it on
        the same fixed unseen set to replace it, so the green champion line cannot regress.
        In 3D: color = family, height = skill, size = params. Hover a row for details.
      </div>

      <div className="buttons">
        <button onClick={() => resetEvolve()} title="Start over from a fresh random population.">reset evolution</button>
      </div>
    </div>
  );
}


