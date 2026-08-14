import { EvolutionWorld } from "./evolve.js";

// Runtime for evolution mode: fetches TinyStories once, holds the
// world. ESM `let` exports are live bindings, so components that
// import evolveWorld always see the current one.
let trainText = null;
let validText = null;
export let evolveWorld = null;
export let evolveState = "idle"; // idle | loading | ready | error
export let evolveError = "";

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
    evolveState = "ready";
  } catch (e) {
    evolveState = "error";
    evolveError = String(e);
  }
}

export function resetEvolve() {
  if (trainText) evolveWorld = new EvolutionWorld(trainText, validText);
}
