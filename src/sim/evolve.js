// ============================================================
// EVOLVE - a population of language organisms under open-ended
// architecture search.
//
// WHY IT IS BUILT THIS WAY (the one idea that matters):
//   Random mutation in a million-parameter weight space is
//   hopeless: random search signal shrinks like 1/d where d is
//   the number of tunable numbers. So evolution here NEVER
//   touches weights. It searches a tiny 4-number genome:
//     K  - how many past characters the organism sees
//     E  - size of each character's internal code
//     H  - brain width (hidden units)
//     lr - how fast it learns
//   Gradient descent trains the weights inside each organism's
//   short life. Evolution keeps the genomes whose learning went
//   furthest on stories it never trained on. Division of labor:
//   evolution picks the recipe, gradient descent does the work.
//
//   Mutations are mostly small informed nudges + recombination
//   of proven genomes, with rare full-random "jumps" kept in on
//   purpose: jumps are how search escapes local optima.
// ============================================================

import { LinguaOrganism, linguaReseed, rng } from "./lingua.js";
import { buildVocab, encodeText } from "./lingua-world.js";

export const KGRID = [2, 4, 8, 16, 24, 32];
export const EGRID = [8, 12, 16, 24];
export const HGRID = [16, 24, 32, 48, 64, 96, 128, 192, 256];
const KMAX = 40;                 // validation pool margin (bigger than any K)
const LR_LO = 0.008, LR_HI = 0.25;

function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function randomGenome() {
  return { K: pick(KGRID), E: pick(EGRID), H: pick(HGRID), lr: 0.02 + rng() * 0.12 };
}

function nudgeGrid(val, grid) {
  let i = grid.indexOf(val);
  if (i < 0) { i = grid.findIndex((x) => x >= val); if (i < 0) i = grid.length - 1; }
  const stepSize = rng() < 0.2 ? 2 : 1;
  const dir = rng() < 0.5 ? -1 : 1;
  return grid[clamp(i + dir * stepSize, 0, grid.length - 1)];
}

// Small mutations of a genome. jumpRate gives one gene a full
// random redraw (the escape hatch from local optima).
export function mutateGenome(g, mutRate, jumpRate) {
  const c = { K: g.K, E: g.E, H: g.H, lr: g.lr };
  const jumpGene = rng() < jumpRate ? Math.floor(rng() * 4) : -1;
  if (jumpGene === 0) c.K = pick(KGRID); else if (rng() < mutRate) c.K = nudgeGrid(c.K, KGRID);
  if (jumpGene === 1) c.E = pick(EGRID); else if (rng() < mutRate) c.E = nudgeGrid(c.E, EGRID);
  if (jumpGene === 2) c.H = pick(HGRID); else if (rng() < mutRate) c.H = nudgeGrid(c.H, HGRID);
  if (jumpGene === 3) c.lr = 0.02 + rng() * 0.12;
  else if (rng() < mutRate) c.lr = clamp(c.lr * Math.exp((rng() + rng() - 1) * 0.5), LR_LO, LR_HI);
  return c;
}

// Informed breeding: start from a parent, sometimes splice in a
// gene from another proven genome (recombination), then mutate.
export function breedGenome(parent, archiveGenomes, mutRate, jumpRate) {
  const c = { ...parent };
  if (archiveGenomes.length > 1 && rng() < 0.3) {
    const other = archiveGenomes[Math.floor(rng() * archiveGenomes.length)];
    if (rng() < 0.5) c.K = other.K;
    if (rng() < 0.5) c.E = other.E;
    if (rng() < 0.5) c.H = other.H;
    if (rng() < 0.5) c.lr = (c.lr + other.lr) / 2;
  }
  return mutateGenome(c, mutRate, jumpRate);
}

export class EvolutionWorld {
  constructor(trainText, validText, opts = {}) {
    linguaReseed(opts.seed ?? 777);
    this.vocab = buildVocab(trainText);
    this.trainIds = encodeText(trainText, this.vocab.stoi);
    this.validIds = encodeText(validText, this.vocab.stoi);

    this.popSize = opts.popSize ?? 6;
    this.stepsPerGen = opts.stepsPerGen ?? 320;   // lifetime training budget
    this.eliteCount = Math.min(2, this.popSize - 1);
    this.params = { mutationRate: 0.55, jumpRate: 0.08 };

    // fixed honest pool: positions in the UNSEEN stories
    this.poolSize = 700;
    this.validPos = new Int32Array(this.poolSize);
    for (let i = 0; i < this.poolSize; i++)
      this.validPos[i] = KMAX + Math.floor(rng() * (this.validIds.length - KMAX - 2));

    this.batchSize = 48;
    this.gen = 1;
    this.nextId = 1;
    this.archive = [];     // proven genomes, best-first
    this.history = [];     // { gen, best, mean, params }
    this.events = [];
    this.bestEver = null;
    this.sample = "";
    this.lnV = Math.log(this.vocab.V);

    this.population = [];
    for (let i = 0; i < this.popSize; i++) {
      const ind = this.spawn(randomGenome(), 0, 0);
      ind.lineage = ind.id;
      this.population.push(ind);
    }
    this.cursor = 0;
    this.log("GENESIS",
      this.popSize + " creatures born with random genomes. each lives " + this.stepsPerGen +
      " training steps; the honest score on unseen stories decides who breeds.", "#7cffb2");
  }

  log(type, msg, color = "#9fb4d8") {
    this.events.push({ t: this.gen, type, msg, color });
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  spawn(genome, parentId, lineage) {
    const org = new LinguaOrganism(this.vocab.V, genome.E, genome.K, genome.H, genome.lr);
    return {
      id: this.nextId++, genome, org, parentId, lineage,
      step: 0, trainEMA: this.lnV, valLoss: null, done: false,
    };
  }

  // One training step for one organism (its whole "eating").
  trainIndividual(ind) {
    const o = ind.org, K = o.K, n = this.trainIds.length, B = this.batchSize;
    const ctx = new Int32Array(B * K);
    const tgt = new Int32Array(B);
    for (let b = 0; b < B; b++) {
      const pos = K + Math.floor(rng() * (n - K - 2));
      for (let k = 0; k < K; k++) ctx[b * K + k] = this.trainIds[pos - K + k];
      tgt[b] = this.trainIds[pos];
    }
    const loss = o.trainBatch(ctx, tgt, B, K);
    ind.trainEMA = ind.trainEMA * 0.97 + loss * 0.03;
    ind.step++;
    if (ind.step >= this.stepsPerGen) {
      ind.valLoss = this.evaluate(o);
      ind.done = true;
    }
  }

  // Honest score: mean surprise on stories it never trained on.
  evaluate(o) {
    const K = o.K, S = 96;
    let sum = 0;
    for (let i = 0; i < S; i++) {
      const pos = this.validPos[Math.floor(rng() * this.poolSize)];
      const row = new Int32Array(K);
      for (let k = 0; k < K; k++) row[k] = this.validIds[pos - K + k];
      const probs = o.predict(row);
      sum += -Math.log(Math.max(probs[this.validIds[pos]], 1e-12));
    }
    return sum / S;
  }

  // Called from the render loop with a real-time budget.
  step(dt, speed = 1) {
    const budget = Math.min(12 * speed, 90);
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
      let alive = null;
      for (const p of this.population) if (!p.done) { alive = p; break; }
      if (!alive) { this.advanceGeneration(); break; }
      const living = this.population.filter((p) => !p.done);
      const ind = living[this.cursor % living.length];
      this.trainIndividual(ind);
      this.cursor++;
    }
  }

  advanceGeneration() {
    const sorted = [...this.population].sort((a, b) => a.valLoss - b.valLoss);
    const best = sorted[0];
    const mean = sorted.reduce((s, x) => s + x.valLoss, 0) / sorted.length;
    this.history.push({ gen: this.gen, best: best.valLoss, mean, params: best.org.paramCount() });

    this.archive.push({
      genome: { ...best.genome }, valLoss: best.valLoss,
      params: best.org.paramCount(), gen: this.gen, lineage: best.lineage,
    });
    this.archive.sort((a, b) => a.valLoss - b.valLoss);
    if (this.archive.length > 12) this.archive.length = 12;

    if (!this.bestEver || best.valLoss < this.bestEver.valLoss) {
      this.bestEver = {
        valLoss: best.valLoss, genome: { ...best.genome },
        params: best.org.paramCount(), gen: this.gen, id: best.id, lineage: best.lineage,
      };
      this.sample = best.org.generate("One day, ", 300, this.vocab.stoi, this.vocab.itos, 0.85);
      this.log("RECORD", "new best: #" + best.id + " scores " + best.valLoss.toFixed(3) +
        " with " + best.org.paramCount() + " params (K" + best.genome.K +
        " E" + best.genome.E + " H" + best.genome.H + ")", "#7cffb2");
    }

    this.log("GEN " + this.gen,
      "best #" + best.id + " score " + best.valLoss.toFixed(3) + " | mean " + mean.toFixed(3) +
      " | " + best.org.paramCount() + " params - breeding next generation", "#6ee7ff");

    // breed: elites reborn fresh + children of the best, mutated
    const next = [];
    const elites = sorted.slice(0, this.eliteCount);
    for (const e of elites) next.push(this.spawn({ ...e.genome }, e.id, e.lineage));
    const archGenomes = this.archive.map((a) => a.genome);
    while (next.length < this.popSize) {
      const parent = rng() < 0.7 ? elites[0] : sorted[Math.floor(rng() * sorted.length)];
      const g = breedGenome(parent.genome, archGenomes, this.params.mutationRate, this.params.jumpRate);
      next.push(this.spawn(g, parent.id, parent.lineage));
    }
    this.population = next;
    this.gen++;
    this.cursor = 0;
  }

  stats() {
    const board = [...this.population].sort((a, b) => (a.valLoss ?? 99) - (b.valLoss ?? 99));
    return {
      gen: this.gen,
      done: this.population.filter((p) => p.done).length,
      total: this.population.length,
      board, bestEver: this.bestEver, sample: this.sample,
      history: this.history, lnV: this.lnV,
      stepsPerGen: this.stepsPerGen, archiveSize: this.archive.length,
    };
  }
}
