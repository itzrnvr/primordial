// Organism sanity: one creature still learns and grows.
import { readFileSync } from "node:fs";
import { LinguaWorld } from "../src/sim/lingua-world.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/data/");
const train = readFileSync(join(dir, "tinystories-train-sample.txt"), "utf8");
const valid = readFileSync(join(dir, "tinystories-valid-sample.txt"), "utf8");

const w = new LinguaWorld(train, valid, { seed: 99 });
for (let i = 0; i < 4200; i++) w.trainOneStep();
const st = w.stats();
console.log("valid " + st.validLoss.toFixed(3) + " params " + st.params + " growths " + st.growths);
console.log(st.validLoss < 2.6 && st.growths > 0 ? "ORGANISM TEST: PASS" : "ORGANISM TEST: FAIL");
process.exit(st.validLoss < 2.6 && st.growths > 0 ? 0 : 1);
