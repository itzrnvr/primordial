import { LinguaWorld } from "./lingua-world.js";
import { saveJSON, loadJSON, clearKey } from "./persist.js";

// Runtime for the organism mode: fetches TinyStories once, holds the
// world, and autosaves it so a refresh keeps the organism's learning.
const LINGUA_KEY = "primordial.lingua.v1";

let trainText = null;
let validText = null;
export let linguaWorld = null;
export let linguaState = "idle"; // idle | loading | ready | error
export let linguaError = "";
let autosaveOn = false;

function startAutosave() {
  if (autosaveOn) return;
  autosaveOn = true;
  const save = () => { if (linguaWorld) saveJSON(LINGUA_KEY, linguaWorld.toSave()); };
  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}

export async function initLingua() {
  if (linguaState === "ready" || linguaState === "loading") return;
  linguaState = "loading";
  try {
    const [t, v] = await Promise.all([
      fetch("data/tinystories-train-sample.txt").then((r) => r.text()),
      fetch("data/tinystories-valid-sample.txt").then((r) => r.text()),
    ]);
    trainText = t;
    validText = v;
    linguaWorld = new LinguaWorld(trainText, validText);
    const saved = loadJSON(LINGUA_KEY);
    if (saved) linguaWorld.applySave(saved);
    linguaState = "ready";
    startAutosave();
  } catch (e) {
    linguaState = "error";
    linguaError = String(e);
  }
}

export function resetLingua() {
  clearKey(LINGUA_KEY);
  if (trainText) linguaWorld = new LinguaWorld(trainText, validText);
}
