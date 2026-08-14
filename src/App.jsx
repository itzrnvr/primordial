import { useEffect } from "react";
import Scene from "./render/Scene.jsx";
import HUD from "./ui/HUD.jsx";
import LinguaHUD from "./ui/LinguaHUD.jsx";
import EvolveHUD from "./ui/EvolveHUD.jsx";
import Controls from "./ui/Controls.jsx";
import EventFeed from "./ui/EventFeed.jsx";
import Inspector from "./ui/Inspector.jsx";
import Help from "./ui/Help.jsx";
import { useStore } from "./state/store.js";
import { initLingua } from "./sim/lingua-runtime.js";
import { initEvolve } from "./sim/evolve-runtime.js";

export default function App() {
  const select = useStore((s) => s.select);
  const bumpTick = useStore((s) => s.bumpTick);
  const togglePause = useStore((s) => s.togglePause);
  const reset = useStore((s) => s.reset);
  const meteor = useStore((s) => s.meteor);
  const mode = useStore((s) => s.mode);

  // slow UI tick so the HUD numbers stay live
  useEffect(() => {
    const id = setInterval(() => bumpTick(), 150);
    return () => clearInterval(id);
  }, [bumpTick]);

  // load TinyStories the first time organism/evolve mode is opened
  useEffect(() => {
    if (mode === "organism") initLingua();
    if (mode === "evolve") initEvolve();
  }, [mode]);

  // keyboard: space pause, R reset, M meteor, Esc deselect
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      else if (e.key === "r" || e.key === "R") { if (mode === "ecosystem") reset(); }
      else if (e.key === "m" || e.key === "M") { if (mode === "ecosystem") meteor(); }
      else if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, reset, meteor, select, mode]);

  return (
    <div className="app">
      <Scene onSelect={select} />
      {mode === "ecosystem" ? (
        <>
          <HUD />
          <Inspector />
          <Help />
        </>
      ) : mode === "organism" ? (
        <LinguaHUD />
      ) : (
        <EvolveHUD />
      )}
      <Controls />
      <EventFeed />
      <div className="hint">
        drag to orbit - scroll to zoom{mode === "ecosystem" ? " - click a cell to inspect" : ""} - [space] pause
      </div>
    </div>
  );
}
