import { create } from "zustand";
import { world } from "../sim/world.js";

// UI state. The simulation itself lives in plain mutable JS
// (world / linguaWorld / evolveWorld). React re-renders on a slow
// tick for the HUD; the 3D layer reads the sims directly per frame.
//
// Pausing is per-mode: while evolution runs, the ecosystem and the
// organism stay stopped - and they STAY stopped when you come back,
// until you press resume.
export const useStore = create((set) => ({
  paused: { ecosystem: false, organism: false, evolve: false },
  mode: "ecosystem",   // ecosystem | organism | evolve
  speed: 1,
  selectedId: null,
  uiTick: 0,
  helpOpen: true,

  togglePause: () => set((s) => ({ paused: { ...s.paused, [s.mode]: !s.paused[s.mode] } })),
  setMode: (mode) =>
    set((s) =>
      mode === "evolve"
        ? { mode, paused: { ...s.paused, ecosystem: true, organism: true } }
        : { mode }
    ),
  setSpeed: (speed) => set({ speed }),
  select: (id) => set({ selectedId: id }),
  bumpTick: () => set((s) => ({ uiTick: s.uiTick + 1 })),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  setParam: (key, value) => {
    world.params[key] = value;
    set({});
  },
  reset: () => {
    world.reset();
    set({ selectedId: null });
  },
  meteor: () => world.meteor(0.45),
}));
