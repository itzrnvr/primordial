import { create } from "zustand";
import { world } from "../sim/world.js";

// UI state. The simulation itself lives in `world` (plain mutable JS).
// React re-renders on a slow tick for the HUD; the 3D layer reads world
// directly every frame.
export const useStore = create((set) => ({
  paused: false,
  mode: "ecosystem",   // ecosystem | organism
  speed: 1,
  selectedId: null,
  uiTick: 0,
  helpOpen: true,

  togglePause: () => set((s) => ({ paused: !s.paused })),
  setMode: (mode) => set({ mode }),
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
