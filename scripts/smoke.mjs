// Headless smoke test for the simulation engine.
// Run with: npm test
import { world } from "../src/sim/world.js";
import { GENE } from "../src/sim/constants.js";

let failures = 0;
function assert(cond, label) {
  console.log((cond ? "PASS" : "FAIL") + " - " + label);
  if (!cond) failures++;
}
function noNaN(label, v) { assert(!Number.isNaN(v), label + " is not NaN (" + (v?.toFixed?.(3) ?? v) + ")"); }

console.log("=== PRIMORDIAL smoke test ===");
const dt = 1 / 60;

// --- 1. life takes hold and reproduces ---
let peak = 0;
for (let i = 0; i < 3000; i++) {          // 50 simulated seconds
  world.step(dt);
  peak = Math.max(peak, world.organisms.length);
}
let st = world.stats();
assert(st.pop > 1, "population survived (pop=" + st.pop + ", peak=" + peak + ")");
assert(st.births > 0, "replication happened (births=" + st.births + ")");
assert(st.maxGeneration >= 2, "generations advanced (max gen=" + st.maxGeneration + ")");
noNaN("avg energy", st.avgEnergy);
noNaN("avg fidelity", st.avgFidelity);
noNaN("avg skill", st.avgSkill);
console.log("   brains learned: avg skill", (st.avgSkill * 100).toFixed(1) + "%, mutation rate", ((1 - st.avgFidelity) * 100).toFixed(1) + "%");

// --- 2. predation mechanics (force hunters, verify no crash + kills possible) ---
const hunters = world.organisms.slice(0, Math.min(40, world.organisms.length));
for (const o of hunters) { o.genome[GENE.PREDATION] = 0.95; o.energy = 200; }
const killsBefore = world.organisms.reduce((s, o) => s + o.kills, 0);
for (let i = 0; i < 1200; i++) world.step(dt);  // 20 more seconds
st = world.stats();
const killsAfter = world.organisms.reduce((s, o) => s + o.kills, 0);
noNaN("avg energy after predation", st.avgEnergy);
console.log("   predation events (20s, forced hunters):", killsAfter - killsBefore);

// --- 3. extinction event + reset ---
world.meteor(0.5);
assert(world.organisms.length > 0, "meteor leaves survivors");
world.reset();
assert(world.organisms.length === 1, "reset returns to LUCA");

console.log(failures === 0 ? "=== ALL PASS ===" : "=== " + failures + " FAILURES ===");
process.exit(failures === 0 ? 0 : 1);
