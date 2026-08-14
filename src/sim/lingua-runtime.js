import { LinguaWorld } from "./lingua-world.js";

// Runtime for the organism mode: fetches TinyStories once, holds
// the world. ESM `let` exports are live bindings, so components
// importing linguaWorld always see the current one.
let trainText = null;
let validText = null;
export let linguaWorld = null;
export let linguaState = "idle"; // idle | loading | ready | error
export let linguaError = "";

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
    linguaState = "ready";
  } catch (e) {
    linguaState = "error";
    linguaError = String(e);
  }
}

export function resetLingua() {
  if (trainText) linguaWorld = new LinguaWorld(trainText, validText);
}
