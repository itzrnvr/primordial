import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { linguaWorld } from "../sim/lingua-runtime.js";
import { evolveWorld } from "../sim/evolve-runtime.js";

export default function EventFeed() {
  useStore((s) => s.uiTick);
  const mode = useStore((s) => s.mode);
  const source =
    mode === "organism" && linguaWorld ? linguaWorld.events :
    mode === "evolve" && evolveWorld ? evolveWorld.events :
    world.events;
  const events = source.slice(-9);
  const isSteps = mode !== "ecosystem";
  return (
    <div className="feed panel">
      {events.map((e, i) => (
        <div className="feed-row" key={i} style={{ opacity: 0.35 + (i / events.length) * 0.65 }}>
          <span className="feed-t">{isSteps ? (mode === "evolve" ? "gen " + e.t : "#" + e.t) : fmtTime(e.t)}</span>
          <span className="feed-type" style={{ color: e.color }}>{e.type}</span>
          <span className="feed-msg">{e.msg}</span>
        </div>
      ))}
    </div>
  );
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}
