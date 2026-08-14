// ============================================================
// EVOLVE - a colony of language microbes under open-ended search.
//
// The genome is tiny and low-dimensional; gradient descent trains
// the weights inside each life. Evolution searches:
//   architecture : K context, E code size, H brain width
//   learning rate: lr, plus learning-rule genes mo (momentum) and
//                  lm (output-layer speed)
//   senses       : sb (spaces), sp (word position), sw (known words)
//   curriculum   : cur (eat easy fragments early in life)
//
// Honest measurement:
//   - a fixed 512-sentence SELECTION set decides who breeds
//   - a separate fixed 128-sentence EXAM set is only ever reported
//   - the champion keeps its trained weights; it is replaced only
//     by a strictly better selection score (monotone progress)
//
// Fair compute:
//   each life gets the same FLOP budget, not the same steps:
//   steps = flopBudget / params. Big brains get fewer steps, small
//   brains more - exactly like a real compute ceiling.
//
// Efficiency pressure (optional slider): breeding selection uses
// score + pressure * size penalty, so smaller brains win ties.
// ============================================================

import { LinguaOrganism, linguaReseed, rng, hashIds } from "./lingua.js";
import { buildVocab, encodeText } from "./lingua-world.js";
import { f32ToB64, b64ToF32 } from "./persist.js";

export const KGRID = [2, 4, 8, 16, 24, 32];
export const EGRID = [8, 12, 16, 24];
export const HGRID = [16, 24, 32, 48, 64, 96, 128, 192, 256];
const MOGRID = [0, 0.9];
const LMGRID = [0.5, 1, 2];
const KMAX = 40;
const LR_LO = 0.008, LR_HI = 0.25;

function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function estParams(g, V) {
  const F = (g.sb ? 1 : 0) + (g.sp ? 1 : 0) + (g.sw ? 1 : 0);
  return V * g.E + g.K * g.E * g.H + g.K * F * g.H + g.H + g.H * V + V;
}

export function randomGenome(senses = true) {
  return {
    K: pick(KGRID), E: pick(EGRID), H: pick(HGRID),
    lr: 0.02 + rng() * 0.12,
    sb: senses && rng() < 0.5 ? 1 : 0,
    sp: senses && rng() < 0.5 ? 1 : 0,
    sw: senses && rng() < 0.4 ? 1 : 0,
    cur: rng() < 0.3 ? 1 : 0,
    mo: rng() < 0.3 ? 0.9 : 0,
    lm: pick(LMGRID),
  };
}

function nudgeGrid(val, grid) {
  let i = grid.indexOf(val);
  if (i < 0) { i = grid.findIndex((x) => x >= val); if (i < 0) i = grid.length - 1; }
  const stepSize = rng() < 0.2 ? 2 : 1;
  const dir = rng() < 0.5 ? -1 : 1;
  return grid[clamp(i + dir * stepSize, 0, grid.length - 1)];
}

// 10 genes: 0 K, 1 E, 2 H, 3 lr, 4 sb, 5 sp, 6 sw, 7 cur, 8 mo, 9 lm
export function mutateGenome(g, mutRate, jumpRate, senses = true) {
  const c = { ...g };
  const jumpGene = rng() < jumpRate ? Math.floor(rng() * 10) : -1;
  if (jumpGene === 0) c.K = pick(KGRID); else if (rng() < mutRate) c.K = nudgeGrid(c.K, KGRID);
  if (jumpGene === 1) c.E = pick(EGRID); else if (rng() < mutRate) c.E = nudgeGrid(c.E, EGRID);
  if (jumpGene === 2) c.H = pick(HGRID); else if (rng() < mutRate) c.H = nudgeGrid(c.H, HGRID);
  if (jumpGene === 3) c.lr = 0.02 + rng() * 0.12;
  else if (rng() < mutRate) c.lr = clamp(c.lr * Math.exp((rng() + rng() - 1) * 0.5), LR_LO, LR_HI);
  const flip = (key) => { c[key] = c[key] ? 0 : 1; };
  if (senses) {
    if (jumpGene === 4) flip("sb"); else if (rng() < mutRate) flip("sb");
    if (jumpGene === 5) flip("sp"); else if (rng() < mutRate) flip("sp");
    if (jumpGene === 6) flip("sw"); else if (rng() < mutRate) flip("sw");
  }
  if (jumpGene === 7) flip("cur"); else if (rng() < mutRate) flip("cur");
  if (jumpGene === 8) c.mo = nudgeGrid(c.mo, MOGRID); else if (rng() < mutRate) c.mo = nudgeGrid(c.mo, MOGRID);
  if (jumpGene === 9) c.lm = nudgeGrid(c.lm, LMGRID); else if (rng() < mutRate) c.lm = nudgeGrid(c.lm, LMGRID);
  return c;
}

export function breedGenome(parent, archiveGenomes, mutRate, jumpRate, senses = true) {
  const c = { ...parent };
  if (archiveGenomes.length > 1 && rng() < 0.3) {
    const other = archiveGenomes[Math.floor(rng() * archiveGenomes.length)];
    for (const key of ["K", "E", "H", "sb", "sp", "sw", "cur", "mo", "lm"]) {
      if ((key === "sb" || key === "sp" || key === "sw") && !senses) continue;
      if (rng() < 0.5) c[key] = other[key];
    }
    if (rng() < 0.5) c.lr = (c.lr + other.lr) / 2;
  }
  return mutateGenome(c, mutRate, jumpRate, senses);
}

export function genomeDistance(a, b) {
  return Math.abs(Math.log2(a.K / b.K)) + Math.abs(Math.log2(a.E / b.E)) +
    Math.abs(Math.log2(a.H / b.H)) + Math.abs(Math.log(a.lr / b.lr)) +
    (a.sb !== b.sb ? 0.5 : 0) + (a.sp !== b.sp ? 0.5 : 0) + (a.sw !== b.sw ? 0.5 : 0) +
    (a.mo !== b.mo ? 0.5 : 0);
}

function snapshotOrganism(o) {
  const s = {
    emb: o.emb.slice(), W1: o.W1.slice(), b1: o.b1.slice(),
    W2: o.W2.slice(), b2: o.b2.slice(), Wf: o.Wf.slice(),
  };
  if (o.vW1) {
    s.vEmb = o.vEmb.slice(); s.vW1 = o.vW1.slice(); s.vWf = o.vWf.slice();
    s.vB1 = o.vB1.slice(); s.vW2 = o.vW2.slice(); s.vB2 = o.vB2.slice();
  }
  return s;
}

function restoreOrganism(o, s) {
  o.emb.set(s.emb); o.W1.set(s.W1); o.b1.set(s.b1); o.W2.set(s.W2); o.b2.set(s.b2); o.Wf.set(s.Wf);
  if (o.vW1 && s.vW1) {
    o.vEmb.set(s.vEmb); o.vW1.set(s.vW1); o.vWf.set(s.vWf);
    o.vB1.set(s.vB1); o.vW2.set(s.vW2); o.vB2.set(s.vB2);
  }
}

export class EvolutionWorld {
  constructor(trainText, validText, opts = {}) {
    linguaReseed(opts.seed ?? 777);
    this.vocab = buildVocab(trainText);
    this.trainIds = encodeText(trainText, this.vocab.stoi);
    this.validIds = encodeText(validText, this.vocab.stoi);

    this.popSize = opts.popSize ?? 6;
    this.uniform = opts.stepsPerGen != null;
    this.stepsPerGen = opts.stepsPerGen ?? 320;
    this.eliteCount = Math.min(2, this.popSize - 1);
    this.params = {
      mutationRate: 0.55, jumpRate: 0.08,
      effPressure: 0,            // 0..1 size penalty in breeding selection
      flopBudget: 16e6,          // compute per life: steps = budget / params
      maxParams: 400000,         // hard size ceiling (kill rule at spawn)
    };
    this.senses = opts.senses ?? true;
    this.spaceId = this.vocab.stoi[" "] ?? 0;

    // Frequent-word table for the word sense + curriculum easy list.
    this.freqSet = this.buildFreqSet(trainText);
    this.easyPos = this.buildEasyPos();

    // Fixed honest pools: 512 selection positions + 128 exam positions.
    this.selSize = 512;
    this.examSize = 128;
    this.poolSize = this.selSize + this.examSize;
    this.validPos = new Int32Array(this.poolSize);
    for (let i = 0; i < this.poolSize; i++)
      this.validPos[i] = KMAX + Math.floor(rng() * (this.validIds.length - KMAX - 2));

    this.batchSize = 48;
    this.gen = 1;
    this.nextId = 1;
    this.archive = [];
    this.history = [];
    this.events = [];
    this.champion = null;
    this.bestEver = null;
    this.sample = "";
    this.lnV = Math.log(this.vocab.V);

    this.population = [];
    for (let i = 0; i < this.popSize; i++) {
      const ind = this.spawn(randomGenome(this.senses), 0, 0);
      ind.lineage = ind.id;
      this.population.push(ind);
    }
    this.cursor = 0;
    this.log("GENESIS",
      this.popSize + " microbes born. each life spends the same compute (" +
      (this.uniform ? this.stepsPerGen + " steps" : Math.round(this.params.flopBudget / 1e6) + "M flops") +
      "); 512 unseen sentences select, 128 different ones examine.", "#7cffb2");
  }

  buildFreqSet(text) {
    const counts = new Map();
    const stoi = this.vocab.stoi;
    const words = text.split(" ");
    for (const w of words) {
      if (w.length < 2 || w.length > 12) continue;
      let h = 2166136261 >>> 0;
      for (let i = 0; i < w.length; i++) h = (Math.imul(h ^ ((stoi[w[i]] ?? 0) + 1), 16777619)) >>> 0;
      counts.set(h, (counts.get(h) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256);
    return new Set(top.map(([h]) => h));
  }

  buildEasyPos() {
    const ids = this.trainIds;
    const n = ids.length;
    const out = [];
    for (let pos = KMAX; pos < n - 1 && out.length < 30000; pos += 3) {
      let s0 = pos;
      while (s0 > 0 && ids[s0 - 1] !== this.spaceId && pos - s0 < 12) s0--;
      let e0 = pos;
      while (e0 < n - 1 && ids[e0 + 1] !== this.spaceId && e0 - s0 < 12) e0++;
      if (this.freqSet.has(hashIds(ids, s0, e0 + 1))) out.push(pos);
    }
    return out;
  }

  log(type, msg, color = "#9fb4d8") {
    this.events.push({ t: this.gen, type, msg, color });
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  budgetFor(params) {
    if (this.uniform) return this.stepsPerGen;
    return clamp(Math.round(this.params.flopBudget / Math.max(2000, params)), 60, 4000);
  }

  spawn(genomeIn, parentId, lineage) {
    let genome = genomeIn;
    for (let tries = 0; tries < 25 && estParams(genome, this.vocab.V) > this.params.maxParams; tries++) {
      genome = randomGenome(this.senses);
    }
    const org = new LinguaOrganism(this.vocab.V, genome.E, genome.K, genome.H, genome.lr, {
      spaceId: this.spaceId, freqSet: this.freqSet,
      fb: genome.sb === 1, fp: genome.sp === 1, fw: genome.sw === 1,
      mom: genome.mo, lm: genome.lm,
    });
    const ind = {
      id: this.nextId++, genome, org, parentId, lineage,
      step: 0, trainEMA: this.lnV, valLoss: null, examLoss: null, done: false,
    };
    ind.budget = this.budgetFor(org.paramCount());
    return ind;
  }

  trainIndividual(ind) {
    const o = ind.org, K = o.K, n = this.trainIds.length, B = this.batchSize;
    const ctx = new Int32Array(B * K);
    const tgt = new Int32Array(B);
    const curriculum = ind.genome.cur === 1 && ind.step < ind.budget * 0.5 && this.easyPos.length > 0;
    for (let b = 0; b < B; b++) {
      const pos = curriculum && rng() < 0.6
        ? this.easyPos[Math.floor(rng() * this.easyPos.length)]
        : K + Math.floor(rng() * (n - K - 2));
      for (let k = 0; k < K; k++) ctx[b * K + k] = this.trainIds[pos - K + k];
      tgt[b] = this.trainIds[pos];
    }
    const loss = o.trainBatch(ctx, tgt, B, K);
    ind.trainEMA = ind.trainEMA * 0.97 + loss * 0.03;
    ind.step++;
    if (ind.step >= ind.budget) {
      const newScore = this.evaluate(o, 0, this.selSize);
      if (ind.isChampion) {
        if (newScore < ind.valLoss) {
          ind.valLoss = newScore;
          ind.examLoss = this.evaluate(o, this.selSize, this.examSize);
          ind.lifeImproved = true;
          this.log("CHAMPION", "champion #" + ind.id + " improved itself to " + newScore.toFixed(3), "#7cffb2");
        } else {
          restoreOrganism(o, ind.snapshot);
          ind.lifeImproved = false;
        }
        ind.snapshot = null;
      } else {
        ind.valLoss = newScore;
        ind.examLoss = this.evaluate(o, this.selSize, this.examSize);
      }
      ind.done = true;
    }
  }

  evaluate(o, from, count) {
    const K = o.K;
    let sum = 0;
    for (let i = from; i < from + count; i++) {
      const pos = this.validPos[i];
      const row = new Int32Array(K);
      for (let k = 0; k < K; k++) row[k] = this.validIds[pos - K + k];
      const probs = o.predict(row);
      sum += -Math.log(Math.max(probs[this.validIds[pos]], 1e-12));
    }
    return sum / count;
  }

  fitness(ind) {
    const sizePenalty = 0.25 * (Math.log10(ind.org.paramCount()) - 4);
    return ind.valLoss + this.params.effPressure * sizePenalty;
  }

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
    const byScore = [...this.population].sort((a, b) => a.valLoss - b.valLoss);
    const best = byScore[0];
    const mean = byScore.reduce((s, x) => s + x.valLoss, 0) / byScore.length;
    const byFit = [...this.population].sort((a, b) => this.fitness(a) - this.fitness(b));

    const previousChampion = this.champion;
    const winner = !previousChampion || best.valLoss < previousChampion.valLoss ? best : previousChampion;
    const championImproved = !!previousChampion && winner.valLoss < previousChampion.valLoss;
    this.champion = winner;
    this.champion.champion = true;
    this.champion.isChampion = true;
    this.champion.retainedGen = this.gen;
    this.bestEver = winner;

    this.history.push({
      gen: this.gen,
      best: winner.valLoss,   // monotone by construction
      mean,
      params: winner.org.paramCount(),
      exam: winner.examLoss ?? null,
      pts: this.population.map((p) => ({ x: Math.log10(p.org.paramCount()), y: p.valLoss })),
    });
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);

    this.archive.push({
      genome: { ...winner.genome }, valLoss: winner.valLoss,
      params: winner.org.paramCount(), gen: this.gen, lineage: winner.lineage,
      id: winner.id,
    });
    this.archive = this.archive.filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i);
    this.archive.sort((a, b) => a.valLoss - b.valLoss);
    if (this.archive.length > 12) this.archive.length = 12;

    this.sample = winner.org.generate("One day, ", 300, this.vocab.stoi, this.vocab.itos, 0.85);
    if (championImproved || !previousChampion) {
      this.log("RECORD", "new champion: #" + winner.id + " scores " + winner.valLoss.toFixed(3) +
        " (exam " + (winner.examLoss ?? 0).toFixed(3) + ") with " + winner.org.paramCount() + " params", "#7cffb2");
    } else if (previousChampion) {
      this.log("RETAINED", "champion #" + previousChampion.id + " retained at " +
        previousChampion.valLoss.toFixed(3) + "; no child beat it this generation", "#ffd27c");
    }
    this.log("GEN " + this.gen,
      "best #" + best.id + " score " + best.valLoss.toFixed(3) + " | mean " + mean.toFixed(3) +
      " | " + best.org.paramCount() + " params - breeding next generation", "#6ee7ff");

    // Breed. Niched parent pool: the two fittest plus the most
    // different proven genome, so several families stay alive.
    const next = [];
    next.push(this.champion);
    const elites = byFit.filter((x) => x !== this.champion).slice(0, Math.max(0, this.eliteCount - 1));
    for (const e of elites) next.push(this.spawn({ ...e.genome }, e.id, e.lineage));

    const pool = [byFit[0], byFit[1] || byFit[0]];
    let diverse = null, bestD = -1;
    for (const a of this.archive) {
      const d = Math.min(genomeDistance(a.genome, pool[0].genome), genomeDistance(a.genome, pool[pool.length - 1].genome));
      if (d > bestD) { bestD = d; diverse = a; }
    }
    if (diverse) pool.push({ genome: diverse.genome, id: diverse.id, lineage: diverse.lineage });
    if (byFit[2] && !pool.includes(byFit[2])) pool.push(byFit[2]);

    const archGenomes = this.archive.map((a) => a.genome);
    while (next.length < this.popSize) {
      const parent = rng() < 0.55 ? pool[0] : pool[Math.floor(rng() * pool.length)];
      const g = breedGenome(parent.genome, archGenomes, this.params.mutationRate, this.params.jumpRate, this.senses);
      next.push(this.spawn(g, parent.id, parent.lineage));
    }
    this.population = next;
    for (const p of this.population) p.champion = p === this.champion;
    const champ = this.champion;
    champ.isChampion = true;
    champ.snapshot = snapshotOrganism(champ.org);
    champ.preLifeScore = champ.valLoss;
    champ.lifeImproved = false;
    champ.step = 0;
    champ.done = false;
    champ.budget = this.budgetFor(champ.org.paramCount());
    this.gen++;
    this.cursor = 0;
  }

  // ---- persistence (v2) ----
  toSave() {
    const c = this.champion;
    return {
      v: 2,
      gen: this.gen,
      nextId: this.nextId,
      params: { ...this.params },
      history: this.history.slice(-200),
      archive: this.archive,
      champion: c ? {
        id: c.id, lineage: c.lineage, genome: c.genome,
        valLoss: c.valLoss, examLoss: c.examLoss, trainEMA: c.trainEMA,
        championGen: c.championGen ?? this.gen,
        w: {
          emb: f32ToB64(c.org.emb), W1: f32ToB64(c.org.W1), b1: f32ToB64(c.org.b1),
          W2: f32ToB64(c.org.W2), b2: f32ToB64(c.org.b2), Wf: f32ToB64(c.org.Wf),
          vEmb: c.org.vEmb ? f32ToB64(c.org.vEmb) : null,
          vW1: c.org.vW1 ? f32ToB64(c.org.vW1) : null,
          vWf: c.org.vWf ? f32ToB64(c.org.vWf) : null,
          vB1: c.org.vB1 ? f32ToB64(c.org.vB1) : null,
          vW2: c.org.vW2 ? f32ToB64(c.org.vW2) : null,
          vB2: c.org.vB2 ? f32ToB64(c.org.vB2) : null,
        },
      } : null,
    };
  }

  applySave(d) {
    if (!d || d.v !== 2 || !d.champion) return false;
    const g = d.champion.genome;
    const ind = this.spawn(g, 0, d.champion.lineage);
    const o = ind.org;
    const w = d.champion.w || {};
    const emb = b64ToF32(w.emb, o.emb.length);
    const W1 = b64ToF32(w.W1, o.W1.length);
    const b1 = b64ToF32(w.b1, o.b1.length);
    const W2 = b64ToF32(w.W2, o.W2.length);
    const b2 = b64ToF32(w.b2, o.b2.length);
    const Wf = b64ToF32(w.Wf, o.Wf.length);
    if (!emb || !W1 || !b1 || !W2 || !b2 || !Wf) return false;
    o.emb.set(emb); o.W1.set(W1); o.b1.set(b1); o.W2.set(W2); o.b2.set(b2); o.Wf.set(Wf);
    if (o.vW1 && w.vW1) {
      const vEmb = b64ToF32(w.vEmb, o.vEmb.length);
      const vW1 = b64ToF32(w.vW1, o.vW1.length);
      const vWf = b64ToF32(w.vWf, o.vWf.length);
      const vB1 = b64ToF32(w.vB1, o.vB1.length);
      const vW2 = b64ToF32(w.vW2, o.vW2.length);
      const vB2 = b64ToF32(w.vB2, o.vB2.length);
      if (vEmb && vW1 && vWf && vB1 && vW2 && vB2) {
        o.vEmb.set(vEmb); o.vW1.set(vW1); o.vWf.set(vWf);
        o.vB1.set(vB1); o.vW2.set(vW2); o.vB2.set(vB2);
      }
    }

    ind.id = d.champion.id;
    ind.valLoss = d.champion.valLoss;
    ind.examLoss = d.champion.examLoss ?? null;
    ind.trainEMA = d.champion.trainEMA ?? this.lnV;
    ind.championGen = d.champion.championGen ?? d.gen;
    ind.isChampion = true;
    ind.champion = true;
    ind.snapshot = snapshotOrganism(o);
    ind.step = 0;
    ind.done = false;
    ind.budget = this.budgetFor(o.paramCount());

    this.nextId = Math.max(d.nextId ?? 1, ind.id + 1);
    this.gen = d.gen ?? 1;
    if (d.params) this.params = { ...this.params, ...d.params };
    this.history = Array.isArray(d.history) ? d.history : [];
    this.archive = Array.isArray(d.archive) ? d.archive : [];

    this.champion = ind;
    this.bestEver = ind;

    const pop = [ind];
    const archGenomes = this.archive.map((a) => a.genome);
    while (pop.length < this.popSize) {
      const parentGenome = archGenomes.length
        ? archGenomes[Math.floor(rng() * archGenomes.length)]
        : g;
      pop.push(this.spawn(
        breedGenome(parentGenome, archGenomes, this.params.mutationRate, this.params.jumpRate, this.senses),
        ind.id, ind.lineage
      ));
    }
    this.population = pop;
    this.cursor = 0;
    this.sample = ind.org.generate("One day, ", 300, this.vocab.stoi, this.vocab.itos, 0.85);
    this.log("RESTORED", "champion #" + ind.id + " woke up at gen " + this.gen +
      " with score " + ind.valLoss.toFixed(3) + " - progress kept", "#7cffb2");
    return true;
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
      uniform: this.uniform, flopBudget: this.params.flopBudget,
      effPressure: this.params.effPressure, maxParams: this.params.maxParams,
    };
  }
}
