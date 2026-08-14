import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <label className="slider">
      <span className="slider-label">
        {label} <em>{format ? format(value) : value.toFixed(2)}</em>
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
      <div className="panel-title">universe controls</div>
      <Slider label="sim speed" value={s.speed} min={0.25} max={8} step={0.25} onChange={s.setSpeed} format={(v) => v + "x"} />
      <Slider label="mutation scale" value={p.mutationScale} min={0} max={3} step={0.05} onChange={(v) => s.setParam("mutationScale", v)} />
      <Slider label="nutrient richness" value={p.richness} min={0.2} max={2.5} step={0.05} onChange={(v) => s.setParam("richness", v)} />
      <Slider label="upkeep (hardness)" value={p.upkeepScale} min={0.4} max={2.5} step={0.05} onChange={(v) => s.setParam("upkeepScale", v)} />
      <Slider label="env drift" value={p.envDrift} min={0} max={0.04} step={0.001} onChange={(v) => s.setParam("envDrift", v)} format={(v) => v.toFixed(3)} />
      <div className="buttons">
        <button onClick={s.togglePause}>{s.paused ? "resume" : "pause"}</button>
        <button className="danger" onClick={s.meteor}>meteor</button>
        <button onClick={s.reset}>reset</button>
      </div>
    </div>
  );
}
