import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { HARD_CAP } from "../sim/constants.js";
import { initLingua } from "../sim/lingua-runtime.js";

function Slider({ label, value, min, max, step, onChange, format, help }) {
  return (
    <label className="slider">
      <span className="slider-label" tabIndex={0}>
        {label} <em>{format ? format(value) : value.toFixed(2)}</em>
        {help && <span className="tip">{help}</span>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default function Controls() {
  useStore((s) => s.uiTick);
  const s = useStore();
  const p = world.params;

  return (
    <div className="controls panel">
      <div className="mode-switch">
        <button
          className={s.mode === "ecosystem" ? "active" : ""}
          title="The ecology: many cells evolving around the vent"
          onClick={() => s.setMode("ecosystem")}
        >ecosystem</button>
        <button
          className={s.mode === "organism" ? "active" : ""}
          title="One organism growing from nothing into a language model on TinyStories"
          onClick={() => { s.setMode("organism"); initLingua(); }}
        >organism</button>
      </div>

      {s.mode === "ecosystem" ? (
        <>
          <div className="panel-title">
            universe controls
            <span className="panel-hint">hover a slider to learn what it does</span>
          </div>
          <Slider label="sim speed" value={s.speed} min={0.25} max={8} step={0.25} onChange={s.setSpeed} format={(v) => v + "x"}
            help="How fast time flows. Higher = everything happens faster. It changes the pace, not the rules." />
          <Slider label="mutation" value={p.mutationScale} min={0} max={3} step={0.05} onChange={(v) => s.setParam("mutationScale", v)}
            help="How different children are from their parents. 0 = exact clones (evolution stops). High = big risky leaps. Around 1 is healthy." />
          <Slider label="food richness" value={p.richness} min={0.2} max={2.5} step={0.05} onChange={(v) => s.setParam("richness", v)}
            help="How much food the yellow vent gives out. More food = easier life and faster population growth." />
          <Slider label="hardness" value={p.upkeepScale} min={0.4} max={2.5} step={0.05} onChange={(v) => s.setParam("upkeepScale", v)}
            help="The cost of staying alive. Higher = every cell burns energy faster, so only efficient, well-fed ones survive. Lower = an easy life." />
          <Slider label="env drift" value={p.envDrift} min={0} max={0.04} step={0.001} onChange={(v) => s.setParam("envDrift", v)} format={(v) => v.toFixed(3)}
            help="How fast the environment's comfort zone moves. Higher = the rules keep changing and cells must keep adapting or starve. 0 = a frozen world." />
          <Slider label="max population" value={p.maxPopulation} min={10} max={HARD_CAP} step={10} onChange={(v) => s.setParam("maxPopulation", v)} format={(v) => String(Math.round(v))}
            help="A hard ceiling on how many cells can exist. Births pause once this is reached. Lowering it below the current count pauses births until deaths thin the herd." />
          <div className="buttons">
            <button onClick={s.togglePause} title="Freeze or resume the whole universe">{s.paused ? "resume" : "pause"}</button>
            <button className="danger" onClick={s.meteor} title="Kill about 45% of cells at random - a disaster to test how fast life recovers">meteor</button>
            <button onClick={s.reset} title="Start over from LUCA, the very first cell">reset</button>
          </div>
        </>
      ) : (
        <>
          <div className="panel-title">
            organism mode
            <span className="panel-hint">its food is TinyStories itself</span>
          </div>
          <Slider label="learn speed" value={s.speed} min={0.25} max={8} step={0.25} onChange={s.setSpeed} format={(v) => v + "x"}
            help="How much training time per second of real time. Higher = it learns faster, but your browser works harder." />
          <div className="mode-note">
            The organism starts knowing nothing. It eats stories by predicting their next character,
            and when it stops improving it grows — longer memory or a wider brain. Watch its speech
            turn from noise into words, then sentences.
          </div>
          <div className="buttons">
            <button onClick={s.togglePause} title="Freeze or resume the organism's learning">{s.paused ? "resume" : "pause"}</button>
          </div>
        </>
      )}
    </div>
  );
}
