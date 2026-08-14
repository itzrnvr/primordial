import { create } from "zustand";
import { world } from "../sim/world.js";

// UI state. The sims themselves live in plain mutable JS
// (world / linguaWorld / evolveWorld). React re-renders on a slow
// tick for the HUD; the 3D layer reads the sims directly per frame.
//
// Pausing is per-mode: while evolution runs, the ecosystem and the
// organism stay stopped - and they STAY stopped when you come back,
// until you press resume.
//
// Mode + pause state persist across refreshes via localStorage.
const UI_KEY = "primordial.ui.v1";

function loadUI() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; }
}
function saveUI(state) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ mode: state.mode, paused: state.paused }));
  } catch { /* ignore */ }
}

const savedUI = typeof localStorage !== "undefined" ? loadUI() : {};
const MODES = ["ecosystem", "organism", "evolve"];
const initMode = MODES.includes(savedUI.mode) ? savedUI.mode : "ecosystem";
const initPaused = {
  ecosystem: false, organism: false, evolve: false,
  ...(savedUI.paused || {}),
};

export const useStore = create((set, get) => ({
  paused: initPaused,
  mode: initMode,
  speed: 1,
  selectedId: null,
  uiTick: 0,
  helpOpen: true,

  togglePause: () => {
    set((s) => ({ paused: { ...s.paused, [s.mode]: !s.paused[s.mode] } }));
    saveUI(get());
  },
  setMode: (mode) => {
    set((s) =>
      mode === "evolve"
        ? { mode, paused: { ...s.paused, ecosystem: true, organism: true } }
        : { mode }
    );
    saveUI(get());
  },
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
