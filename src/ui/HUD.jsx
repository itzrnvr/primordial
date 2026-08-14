import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { Spark, AdaptChart } from "./Charts.jsx";

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export default function HUD() {
  useStore((s) => s.uiTick); // re-render on the slow UI tick
  const st = world.stats();
  const H = world.history;
  const mutRate = ((1 - st.avgFidelity) * 100).toFixed(1);

  return (
    <div className="hud panel">
      <div className="title">
        PRIMORDIAL<span className="sub">digital evolution</span>
      </div>
      <div className="statgrid">
        <div><b>{st.pop}</b>population</div>
        <div><b>gen {st.maxGeneration}</b>deepest lineage</div>
        <div><b>{st.lineages}</b>lineages</div>
        <div><b>{fmtTime(st.time)}</b>epoch</div>
        <div><b>{st.births}</b>births</div>
        <div><b>{st.deaths}</b>deaths</div>
        <div><b>{(st.avgSkill * 100).toFixed(0)}%</b>avg brain skill</div>
        <div><b>{mutRate}%</b>mutation rate</div>
      </div>
      <div className="charts">
        <Spark label="population" data={H.pop} color="#7cffb2" min={0} max={Math.max(10, ...H.pop)} value={st.pop} />
        <Spark label="fidelity (copy accuracy)" data={H.fidelity} color="#ffd27c" min={0} max={1} value={st.avgFidelity.toFixed(3)} />
        <Spark label="brain skill" data={H.skill} color="#6ee7ff" min={0} max={1} value={(st.avgSkill * 100).toFixed(0) + "%"} />
        <AdaptChart />
      </div>
    </div>
  );
}
