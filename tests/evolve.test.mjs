// Monotone-champion regression test: the retained best score must
// never increase across generations.
import { readFileSync } from "node:fs";
import { EvolutionWorld } from "../src/sim/evolve.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/data/");
const train = readFileSync(join(dir, "tinystories-train-sample.txt"), "utf8");
const valid = readFileSync(join(dir, "tinystories-valid-sample.txt"), "utf8");

const GENS = 5;
const w = new EvolutionWorld(train, valid, { popSize: 5, stepsPerGen: 160, seed: 4242 });
while (w.gen <= GENS) w.step(0.016, 50);
let ok = true;
for (let i = 1; i < w.history.length; i++) {
  if (w.history[i].best > w.history[i - 1].best + 1e-12) ok = false;
}
console.log("champion line: " + w.history.map((h) => h.best.toFixed(4)).join(" -> "));
console.log(ok ? "EVOLVE TEST: PASS" : "EVOLVE TEST: FAIL");
process.exit(ok ? 0 : 1);
