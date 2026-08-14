// Persistence round-trip: save -> restore -> keep evolving monotonically.
import { readFileSync } from "node:fs";
import { EvolutionWorld } from "../src/sim/evolve.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/data/");
const train = readFileSync(join(dir, "tinystories-train-sample.txt"), "utf8");
const valid = readFileSync(join(dir, "tinystories-valid-sample.txt"), "utf8");

const w = new EvolutionWorld(train, valid, { popSize: 5, stepsPerGen: 160, seed: 7 });
while (w.gen <= 3) w.step(0.016, 50);
const json = JSON.stringify(w.toSave());
const savedScore = w.champion.valLoss;

const w2 = new EvolutionWorld(train, valid, { popSize: 5, stepsPerGen: 160, seed: 999 });
const okRestore = w2.applySave(JSON.parse(json));
const restoredScore = w2.champion ? w2.champion.valLoss : NaN;
while (w2.gen <= 5) w2.step(0.016, 50);
const all = w2.history.map((h) => h.best);
let mono = true;
for (let i = 1; i < all.length; i++) if (all[i] > all[i - 1] + 1e-9) mono = false;
const ok = okRestore && mono && Math.abs(restoredScore - savedScore) < 1e-6;
console.log("restored champ " + restoredScore.toFixed(4) + " expected " + savedScore.toFixed(4));
console.log("line: " + all.map((x) => x.toFixed(4)).join(" -> "));
console.log(ok ? "PERSIST TEST: PASS" : "PERSIST TEST: FAIL");
process.exit(ok ? 0 : 1);

