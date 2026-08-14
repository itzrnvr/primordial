import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export default function EventFeed() {
  useStore((s) => s.uiTick);
  const events = world.events.slice(-9);
  return (
    <div className="feed panel">
      {events.map((e, i) => (
        <div className="feed-row" key={i} style={{ opacity: 0.35 + (i / events.length) * 0.65 }}>
          <span className="feed-t">{fmtTime(e.t)}</span>
          <span className="feed-type" style={{ color: e.color }}>{e.type}</span>
          <span className="feed-msg">{e.msg}</span>
        </div>
      ))}
    </div>
  );
}
