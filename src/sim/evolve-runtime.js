import { EvolutionWorld } from "./evolve.js";
import { saveJSON, loadJSON, clearKey, serverLoad, serverSave, serverDelete } from "./persist.js";

// Runtime for the evolution mode: fetches TinyStories once, holds the
// world, and autosaves to PostgreSQL (with a localStorage cache) so
// closing the tab loses nothing.
const EVO_KEY = "primordial.evo.v2";

let trainText = null;
let validText = null;
export let evolveWorld = null;
export let evolveState = "idle"; // idle | loading | ready | error
export let evolveError = "";
let autosaveOn = false;

function startAutosave() {
  if (autosaveOn) return;
  autosaveOn = true;
  const save = () => {
    if (!evolveWorld) return;
    const data = evolveWorld.toSave();
    saveJSON(EVO_KEY, data);
    serverSave("evolve", data);
  };
  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}

export async function initEvolve() {
  if (evolveState === "ready" || evolveState === "loading") return;
  evolveState = "loading";
  try {
    const [t, v] = await Promise.all([
      fetch("data/tinystories-train-sample.txt").then((r) => r.text()),
      fetch("data/tinystories-valid-sample.txt").then((r) => r.text()),
    ]);
    trainText = t;
    validText = v;
    evolveWorld = new EvolutionWorld(trainText, validText);
    const remote = await serverLoad("evolve");
    const saved = remote ?? loadJSON(EVO_KEY);
    if (saved) evolveWorld.applySave(saved);
    evolveState = "ready";
    startAutosave();
  } catch (e) {
    evolveState = "error";
    evolveError = String(e);
  }
}

export function resetEvolve() {
  clearKey(EVO_KEY);
  serverDelete("evolve");
  if (trainText) evolveWorld = new EvolutionWorld(trainText, validText);
}
