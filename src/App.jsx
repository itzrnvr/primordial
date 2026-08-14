import { useEffect } from "react";
import Scene from "./render/Scene.jsx";
import HUD from "./ui/HUD.jsx";
import Controls from "./ui/Controls.jsx";
import EventFeed from "./ui/EventFeed.jsx";
import Inspector from "./ui/Inspector.jsx";
import { useStore } from "./state/store.js";

export default function App() {
  const select = useStore((s) => s.select);
  const bumpTick = useStore((s) => s.bumpTick);
  const togglePause = useStore((s) => s.togglePause);
  const reset = useStore((s) => s.reset);
  const meteor = useStore((s) => s.meteor);

  // slow UI tick so the HUD numbers stay live
  useEffect(() => {
    const id = setInterval(() => bumpTick(), 150);
    return () => clearInterval(id);
  }, [bumpTick]);

  // keyboard: space pause, R reset, M meteor, Esc deselect
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      else if (e.key === "r" || e.key === "R") reset();
      else if (e.key === "m" || e.key === "M") meteor();
      else if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, reset, meteor, select]);

  return (
    <div className="app">
      <Scene onSelect={select} />
      <HUD />
      <Controls />
      <EventFeed />
      <Inspector />
      <div className="hint">
        drag to orbit - scroll to zoom - click a cell to inspect - [space] pause - [m] meteor - [r] reset
      </div>
    </div>
  );
}
