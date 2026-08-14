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
          ? "gen " + history[hover].gen + ": champion " + history[hover].best.toFixed(3) +
            (history[hover].exam != null ? " (exam " + history[hover].exam.toFixed(3) + ")" : "") +
            " - colony mean " + history[hover].mean.toFixed(3) + " - lower is better"
          : "green = reigning champion score, can only improve. grey = colony average. hover for exact numbers."}
      </div>
    </div>
  );
}

// quality vs size: dots = scored microbes, cyan line = Pareto frontier
function ParetoChart({ history, archive }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const pts = [];
    for (const a of archive) pts.push({ x: Math.log10(a.params), y: a.valLoss, arch: true });
    const last = history[history.length - 1];
    if (last && last.pts) for (const p of last.pts) pts.push({ x: p.x, y: p.y, arch: false });
    if (pts.length < 2) {
      ctx.fillStyle = "#5a6c8c";
      ctx.font = "10px monospace";
      ctx.fillText("appears after the first generation", 8, 50);
      return;
    }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs) - 0.08, x1 = Math.max(...xs) + 0.08;
    const y0 = Math.min(...ys) - 0.08, y1 = Math.max(...ys, 4.3);
    const X = (x) => ((x - x0) / (x1 - x0)) * (c.width - 12) + 6;
    const Y = (y) => c.height - ((y - y0) / (y1 - y0)) * (c.height - 12) - 6;
    for (const p of pts) {
      ctx.fillStyle = p.arch ? "rgba(124,255,178,.85)" : "rgba(159,180,216,.45)";
      ctx.fillRect(X(p.x) - 1.5, Y(p.y) - 1.5, 3, 3);
    }
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    let minY = 1e9, started = false;
    ctx.strokeStyle = "#6ee7ff";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const p of sorted) {
      if (p.y < minY) {
        minY = p.y;
        if (!started) { ctx.moveTo(X(p.x), Y(p.y)); started = true; }
        else ctx.lineTo(X(p.x), Y(p.y));
      }
    }
    ctx.stroke();
    ctx.fillStyle = "#4d5f7a";
    ctx.font = "8px monospace";
    ctx.fillText("smaller", 6, c.height - 2);
    ctx.fillText("bigger", c.width - 34, c.height - 2);
  });
  return <canvas ref={ref} width={300} height={90} className="loss-canvas" />;
}

const COLS = {
  who: "who: the microbe id and its family colour. champ = reigning champion - keeps its trained weights, only replaced by a strictly better child.",
  score: "score: surprise per character on the fixed 512-sentence selection set, measured when its life ends. lower is better, random guessing = 4.25. while training you see life progress instead.",
  params: "params: how many learned weights its brain has. bigger is not automatically better - with equal compute per life, small brains train more thoroughly.",
  genes: "genes: the inherited recipe. K = past characters seen, E = code size per character, H = brain units. learning rule and senses show in the row hover.",
  senses: "senses: evolved ways of seeing the text. b = spaces, p = word position, w = known words. lit = on. the pale halo in 3D marks sensing microbes.",
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
  const sensesText = (g) =>
    (g.sb ? "b" : "") + (g.sp ? "p" : "") + (g.sw ? "w" : "") || "none";
  const rowHelp = hoverRow
    ? "#" + hoverRow.id + (hoverRow.champion ? " (reigning champion) " : " ") +
      "- family " + hoverRow.lineage +
      " - genes K" + hoverRow.genome.K + " E" + hoverRow.genome.E + " H" + hoverRow.genome.H +
      ", lr " + hoverRow.genome.lr.toFixed(3) +
      (hoverRow.genome.mo ? ", momentum " + hoverRow.genome.mo : "") +
      (hoverRow.genome.lm !== 1 ? ", output speed x" + hoverRow.genome.lm : "") +
      (hoverRow.genome.cur ? ", curriculum on" : "") +
      " - senses: " + sensesText(hoverRow.genome) +
      " - compute " + hoverRow.budget + " steps this life" +
      (hoverRow.done
        ? ". score " + hoverRow.valLoss.toFixed(3) + " on the selection set, exam " +
          (hoverRow.examLoss ?? 0).toFixed(3) + " on the never-used 128 (lower better, random 4.25)"
        : ". being taught: step " + hoverRow.step + " of " + hoverRow.budget)
    : null;
  const detail = rowHelp || (colHelp ? COLS[colHelp] : null) ||
    "a colony of microbes eating TinyStories under a compute ceiling. hover a row to inspect a microbe - hover a column label to learn what the column means.";
  return (
    <div className="hud lingua panel">
      <div className="title">EVOLUTION<span className="sub">a colony of microbes: eat, learn, evolve</span></div>

      <div className="status-line">
        gen <b>{st.gen}</b> · scored <b>{st.done}/{st.total}</b> · champion <b>{st.bestEver ? st.bestEver.valLoss.toFixed(3) : "pending"}</b> · archive <b>{st.archiveSize}</b>
      </div>

      {be && (
        <div className="evo-best" title="Score is measured on the fixed 512-sentence selection set. The exam score uses 128 different sentences that never take part in any decision - a pure report card.">
          <b className="c-green">best ever</b> gen {be.championGen ?? st.gen} #{be.id}: <b>{be.valLoss.toFixed(3)}</b> · exam <b>{(be.examLoss ?? 0).toFixed(3)}</b> · {fmtParams(be.org.paramCount())} params
          <br />
          K={be.genome.K} E={be.genome.E} H={be.genome.H} lr={be.genome.lr.toFixed(3)}{be.genome.mo ? " mom" + be.genome.mo : ""}{be.genome.lm !== 1 ? " outx" + be.genome.lm : ""} · senses {sensesText(be.genome)}
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
              <td>{p.done ? p.valLoss.toFixed(3) : <span className="evo-training">learning {Math.round((100 * p.step) / p.budget)}%</span>}</td>
              <td>{fmtParams(p.org.paramCount())}</td>
              <td>K{p.genome.K} E{p.genome.E} H{p.genome.H}</td>
              <td>
                <span className={p.genome.sb ? "sense" : "sense off"}>b</span>
                <span className={p.genome.sp ? "sense" : "sense off"}>p</span>
                <span className={p.genome.sw ? "sense" : "sense off"}>w</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="evo-detail">{detail}</div>

      <GenChart history={st.history} />

      <div className="lingua-sample-title">quality vs size (pareto)</div>
      <ParetoChart history={st.history} archive={st.board.filter((p) => p.done).map((p) => ({ params: p.org.paramCount(), valLoss: p.valLoss }))} />
      <div className="evo-explain">
        dots = scored microbes (green = proven archive), cyan line = best score at each size.
        left and down = the dream: tiny and smart.
      </div>

      <div className="lingua-sample-title">what the champion says</div>
      <div className="lingua-sample">{st.sample || "(no champion yet - the first generation is still alive)"}</div>

      <div className="buttons">
        <button onClick={() => {
          const blob = new Blob([JSON.stringify(evolveWorld.toSave())], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "primordial-champion-gen" + st.gen + ".json";
          a.click();
          URL.revokeObjectURL(a.href);
        }} title="Save the reigning champion (trained weights + genome) as a JSON file.">download champion</button>
        <button onClick={() => resetEvolve()} title="Start over from a fresh random colony.">reset</button>
      </div>
    </div>
  );
}
