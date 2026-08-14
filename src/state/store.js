import { create } from "zustand";
import { world } from "../sim/world.js";

// UI state. The simulation itself lives in `world` (plain mutable
// JS) - React only re-renders on a slow tick for the HUD, while the
// 3D layer reads world directly every frame.
export const useStore = create((set) => ({
  paused: false,
  speed: 1,
  selectedId: null,
  uiTick: 0,

  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  select: (id) => set({ selectedId: id }),
  bumpTick: () => set((s) => ({ uiTick: s.uiTick + 1 })),

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
