import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { Spark, AdaptChart } from "./Charts.jsx";

export function lineageColorCSS(id) {
  const h = (id * 137.508) % 360;
  return "hsl(" + h.toFixed(0) + ", 72%, 58%)";
}

export default function HUD() {
  useStore((s) => s.uiTick);
  const st = world.stats();
  const H = world.history;

  return (
    <div className="hud panel">
      <div className="title">PRIMORDIAL<span className="sub">survive long - leave many children</span></div>

      <div className="status-line">
        <b>{st.pop}</b> cells alive · generation <b>{st.maxGeneration}</b> · <b>{st.lineages}</b> families
      </div>

      <div className="fam-title">who's winning — each family's share of all life</div>
      <div className="fam-bar" title="Each colored slice is one family. Bigger slice = more descendants.">
        {st.pop > 0 ? st.lineageShares.map((f) => (
          <div key={f.id} className="fam-seg"
            style={{ width: (f.share * 100).toFixed(1) + "%", background: lineageColorCSS(f.id) }}
            title={"family #" + f.id + ": " + f.count + " cells (" + (f.share * 100).toFixed(0) + "%)"} />
        )) : <div className="fam-empty">extinct — press reset</div>}
      </div>

      <div className="goals">
        <div className="goal" title="SURVIVAL goal: how long the oldest living cell has been alive.">
          <span className="goal-val">{st.oldestAge.toFixed(0)}s</span>
          <span className="goal-lab">oldest alive #{st.oldestId ?? "-"}</span>
        </div>
        <div className="goal" title="REPRODUCTION goal: most children any living cell has produced.">
          <span className="goal-val">{st.topChildren}</span>
          <span className="goal-lab">most children #{st.topParentId ?? "-"}</span>
        </div>
        <div className="goal" title="All-time records: longest life ever lived, most children ever produced.">
          <span className="goal-val">{st.recordAge.toFixed(0)}s · {st.recordChildren}</span>
          <span className="goal-lab">records: life · children</span>
        </div>
      </div>

      <div className="vitals">
        <div className="vital" title="Total cells born since the beginning"><span className="v-num">{st.births}</span><span className="v-lab">born</span></div>
        <div className="vital" title="Total cells that died"><span className="v-num">{st.deaths}</span><span className="v-lab">died</span></div>
        <div className="vital" title="Cells that hunt and eat other cells"><span className="v-num">{st.hunters}</span><span className="v-lab">hunters</span></div>
        <div className="vital" title="Cells low on energy - they die if they don't eat soon"><span className="v-num">{st.starving}</span><span className="v-lab">starving</span></div>
      </div>

      <div className="env-line">
        <span className="env-chip">{st.season}</span>
        <span>mutation <b>{((1 - st.avgFidelity) * 100).toFixed(1)}%</b></span>
      </div>

      <div className="foresight" title="Every cell grows a tiny brain that learns to predict where food will be. Better predictions = the cell eats up to ~4x more. This is the average accuracy of all living cells.">
        foresight <b>{(st.avgSkill * 100).toFixed(0)}%</b>
        <span className="foresight-sub">cells predict food — smarter cells eat up to 4x more</span>
      </div>

      <div className="charts">
        <Spark label="population over time" data={H.pop} color="#7cffb2" min={0} max={Math.max(10, ...H.pop)} value={st.pop} height={40} />
        <AdaptChart height={46} />
        <div className="chart-caption">
          evolution race: <i className="dot cyan" />what cells are, chasing <i className="dot orange" />what the environment wants.
        </div>
      </div>
    </div>
  );
}
