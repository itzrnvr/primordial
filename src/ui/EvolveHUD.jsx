import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store.js";
import { evolveWorld, evolveState, evolveError, resetEvolve } from "../sim/evolve-runtime.js";

function fmtParams(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}
function lineageColor(id) {
  return "hsl(" + (((id || 1) * 137.508) % 360) + ",75%,60%)";
}

// champion (green, never worsens) and colony mean (grey) per generation
function GenChart({ history }) {
  const ref = useRef();
  const [hover, setHover] = useState(null);
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
    if (hover != null && history[hover]) {
      const x = (hover / (history.length - 1)) * (c.width - 8) + 4;
      ctx.strokeStyle = "rgba(207,224,244,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x, c.height - 2);
      ctx.stroke();
    }
  });
  const onMove = (e) => {
    if (history.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - 4) / (rect.width - 8)) * (history.length - 1));
    setHover(Math.max(0, Math.min(history.length - 1, i)));
  };
  return (
    <div>
      <canvas ref={ref} width={300} height={64} className="loss-canvas" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      <div className="chart-legend">
        <span><i className="lg lg-green" />champion (never worsens)</span>
        <span><i className="lg lg-grey" />colony mean</span>
      </div>
      <div className="evo-detail">
        {hover != null && history[hover]
          ? "gen " + history[hover].gen + ": champion " + history[hover].best.toFixed(3) + " - colony mean " + history[hover].mean.toFixed(3) + " - lower is better"
          : "green = reigning champion score, can only improve. grey = colony average that generation. hover the chart for exact numbers."}
      </div>
    </div>
  );
}

const COLS = {
  who: "who: the microbe id and its family colour. champ = reigning champion - keeps its trained weights, only replaced by a strictly better child.",
  score: "score: honest surprise per character on stories it never trained on, measured when its life ends. lower is better, random guessing = 4.25. while training you see life progress instead.",
  params: "params: how many learned weights its brain has. bigger is not automatically better - the score decides who breeds.",
  genes: "genes: the inherited recipe. K = how many past characters it sees, E = size of each character code, H = brain units. learn rate shows in the row hover.",
  senses: "senses: evolved ways of seeing the text. b = sees spaces and word boundaries, p = feels position inside the word. lit = on. evolution discovers which representation learns best.",
};

export default function EvolveHUD() {
  useStore((s) => s.uiTick);
  const [hoverId, setHoverId] = useState(null);
  const [colHelp, setColHelp] = useState(null);
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
  const hoverRow = hoverId == null ? null : st.board.find((p) => p.id === hoverId);
  const rowHelp = hoverRow
    ? "#" + hoverRow.id + (hoverRow.champion ? " (reigning champion) " : " ") +
      "- family " + hoverRow.lineage +
      " - genes: memory K" + hoverRow.genome.K + ", code E" + hoverRow.genome.E +
      ", brain H" + hoverRow.genome.H + ", learn rate " + hoverRow.genome.lr.toFixed(3) +
      (hoverRow.genome.sb ? ", boundary sense ON (sees spaces)" : "") +
      (hoverRow.genome.sp ? ", position sense ON (feels word position)" : "") +
      (hoverRow.done
        ? ". honest score " + hoverRow.valLoss.toFixed(3) + " (lower is better, random = 4.25)"
        : ". being taught: step " + hoverRow.step + " of " + st.stepsPerGen + " - its score appears when the life ends")
    : null;
  const detail = rowHelp || (colHelp ? COLS[colHelp] : null) ||
    "a colony of microbes eating TinyStories. hover a row to inspect a microbe - hover a column label to learn what the column means.";
  return (
    <div className="hud lingua panel">
      <div className="title">EVOLUTION<span className="sub">a colony of microbes: eat, learn, evolve</span></div>

      <div className="status-line">
        gen <b>{st.gen}</b> · scored <b>{st.done}/{st.total}</b> · champion score <b>{st.bestEver ? st.bestEver.valLoss.toFixed(3) : "pending"}</b> · archive <b>{st.archiveSize}</b>
      </div>

      {be && (
        <div className="evo-best" title="The honest score is the average surprise per character on stories it NEVER trained on. Random guessing = 4.25. Lower = smarter.">
          <b className="c-green">best ever</b> gen {be.championGen ?? st.gen} #{be.id}: <b>{be.valLoss.toFixed(3)}</b> · {fmtParams(be.org.paramCount())} params
          <br />
          genome K={be.genome.K} E={be.genome.E} H={be.genome.H} lr={be.genome.lr.toFixed(3)}{be.genome.sb ? " +boundary" : ""}{be.genome.sp ? " +position" : ""}
        </div>
      )}

      <table className="evo-table">
        <thead>
          <tr>
            <th onMouseEnter={() => setColHelp("who")} onMouseLeave={() => setColHelp(null)}>who</th>
            <th onMouseEnter={() => setColHelp("score")} onMouseLeave={() => setColHelp(null)}>score (low = good)</th>
            <th onMouseEnter={() => setColHelp("params")} onMouseLeave={() => setColHelp(null)}>params</th>
            <th onMouseEnter={() => setColHelp("genes")} onMouseLeave={() => setColHelp(null)}>genes</th>
            <th onMouseEnter={() => setColHelp("senses")} onMouseLeave={() => setColHelp(null)}>senses</th>
          </tr>
        </thead>
        <tbody>
          {st.board.map((p) => (
            <tr key={p.id} onMouseEnter={() => setHoverId(p.id)} onMouseLeave={() => setHoverId(null)}>
              <td>
                <span className="evo-dot" style={{ background: lineageColor(p.lineage) }} />
                {p.champion ? <b className="c-green">champ</b> : "#" + p.id}
              </td>
              <td>{p.done ? p.valLoss.toFixed(3) : <span className="evo-training">learning {Math.round((100 * p.step) / st.stepsPerGen)}%</span>}</td>
              <td>{fmtParams(p.org.paramCount())}</td>
              <td>K{p.genome.K} E{p.genome.E} H{p.genome.H}</td>
              <td>
                <span className={p.genome.sb ? "sense" : "sense off"}>b</span>
                <span className={p.genome.sp ? "sense" : "sense off"}>p</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="evo-detail">{detail}</div>

      <GenChart history={st.history} />

      <div className="lingua-sample-title">what the champion says</div>
      <div className="lingua-sample">{st.sample || "(no champion yet - the first generation is still alive)"}</div>

      <div className="evo-explain">
        Each microbe eats stories and is taught by gradient descent inside its short life.
        Its genome: K memory, E code size, H brain width, lr learn rate, plus evolved senses -
        b = sees spaces and word boundaries, p = feels position inside a word. Senses change how
        the text is represented; evolution discovers which representation learns best.
        The champion keeps its trained weights; a child replaces it only by beating the same
        fixed unseen test. In 3D: color = family, height = skill, size = params.
      </div>

      <div className="buttons">
        <button onClick={() => resetEvolve()} title="Start over from a fresh random colony.">reset evolution</button>
      </div>
    </div>
  );
}
