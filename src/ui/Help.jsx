import { useStore } from "../state/store.js";

// The onboarding legend: what everything on screen means.
export default function Help() {
  const open = useStore((s) => s.helpOpen);
  const toggle = useStore((s) => s.toggleHelp);
  return (
    <div className={"help panel" + (open ? "" : " help-closed")}>
      <button className="help-toggle" onClick={toggle}>
        {open ? "hide guide" : "? what am I looking at?"}
      </button>
      {open && (
        <div className="help-body">
          <p>
            The <b className="c-sun">yellow ball</b> is a hydrothermal vent — the <b>only food source</b>.
            Its glow is the feeding zone: food is richest close to the ball and fades with distance.
            Cells swim there to eat.
          </p>
          <p>
            When a cell saves enough energy it <b>splits in two</b>. The child is slightly different — a mutation.
            Cells that fit the environment eat more, split more, and their family takes over. That's evolution.
            The goals: <b>survive long</b> and <b>leave many children</b>.
          </p>
          <ul>
            <li><i className="sw sw-family" /> colour = family. Same colour means related.</li>
            <li><i className="sw sw-red" /> red tint = a hunter that eats other cells.</li>
            <li><i className="sw sw-dim" /> dim = starving · bright = well fed.</li>
            <li><i className="sw sw-flash" /> white flash = a cell just split.</li>
            <li>Click any cell to read its genes.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
