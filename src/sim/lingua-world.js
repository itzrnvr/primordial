// ============================================================
// LINGUA WORLD - the organism's life, orchestrated.
// Feeds it TinyStories, watches its loss, and decides when it
// has plateaued and should GROW. Also keeps the validation
// score honest (on stories it never trained on).
// ============================================================

import { LinguaOrganism, linguaReseed, rng } from "./lingua.js";
import { f32ToB64, b64ToF32 } from "./persist.js";

// Build a character vocabulary from the most frequent chars.
// Anything rarer maps to id 0 ("unknown").
export function buildVocab(text, maxVocab = 70) {
  const freq = new Map();
  for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxVocab - 1);
  const stoi = { "\u0000": 0 };
  const itos = ["\u0000"];
  for (const [c] of top) {
    stoi[c] = itos.length;
    itos.push(c);
  }
  return { V: itos.length, stoi, itos };
}

export function encodeText(text, stoi) {
  const ids = new Int32Array(text.length);
  for (let i = 0; i < text.length; i++) ids[i] = stoi[text[i]] ?? 0;
  return ids;
}

const KMAX = 40; // biggest context window we will ever grow to

export class LinguaWorld {
  constructor(trainText, validText, opts = {}) {
    linguaReseed(opts.seed ?? 99);
    this.vocab = buildVocab(trainText);
    this.trainIds = encodeText(trainText, this.vocab.stoi);
    this.validIds = encodeText(validText, this.vocab.stoi);

    this.E = 16;                                   // embedding size (fixed)
    this.maxParams = opts.maxParams ?? 400000;     // the storage ceiling
    this.org = new LinguaOrganism(this.vocab.V, this.E, 2, 16, 0.06);

    // fixed validation positions, far from the edges so any K fits
    this.poolSize = 900;
    this.validPos = new Int32Array(this.poolSize);
    for (let i = 0; i < this.poolSize; i++) {
      this.validPos[i] = KMAX + Math.floor(rng() * (this.validIds.length - KMAX - 2));
    }

    this.batchSize = 48;
    this.ctx = new Int32Array(this.batchSize * KMAX);
    this.tgt = new Int32Array(this.batchSize);

    this.steps = 0;
    const lnV = Math.log(this.vocab.V);
    this.trainEMA = lnV;
    this.validEMA = lnV;
    this.validAtLastGrowth = lnV;
    this.stepsSinceGrowth = 0;
    this.patience = opts.patience ?? 150;   // min steps between growth decisions
    this.minDelta = opts.minDelta ?? 0.02;    // improvement needed to keep not-growing (tuned for the full corpus)
    this.capped = false;
    this.flash = 0;

    this.events = [];
    this.history = { steps: [], train: [], valid: [], params: [] };
    this.sample = "";
    this.log("BIRTH", "an organism is born: sees 2 characters, 16 brain units, " + this.org.paramCount() + " params. it knows nothing.", "#7cffb2");
  }

  log(type, msg, color = "#9fb4d8") {
    this.events.push({ t: this.steps, type, msg, color });
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  // One feeding: a random batch of story fragments, predict the
  // next character, learn from the mistake.
  trainOneStep() {
    const o = this.org;
    const K = o.K;
    const n = this.trainIds.length;
    for (let b = 0; b < this.batchSize; b++) {
      const pos = K + Math.floor(rng() * (n - K - 2));
      for (let k = 0; k < K; k++) this.ctx[b * KMAX + k] = this.trainIds[pos - K + k];
      this.tgt[b] = this.trainIds[pos];
    }
    // trainBatch reads ctx rows of length K (stride KMAX is handled below)
    const loss = o.trainBatch(this.ctx, this.tgt, this.batchSize, KMAX);
    this.trainEMA = this.trainEMA * 0.99 + loss * 0.01;

    // rotating honest validation (stories it never trained on)
    let vsum = 0;
    const VS = 36;
    const base = (this.steps * VS) % this.poolSize;
    for (let i = 0; i < VS; i++) {
      const pos = this.validPos[(base + i) % this.poolSize];
      const row = new Int32Array(K);
      for (let k = 0; k < K; k++) row[k] = this.validIds[pos - K + k];
      const probs = o.predict(row);
      vsum += -Math.log(Math.max(probs[this.validIds[pos]], 1e-12));
    }
    this.validEMA = this.validEMA * 0.985 + (vsum / VS) * 0.015;

    this.steps++;
    this.stepsSinceGrowth++;

    // growth decision: plateaued and not improving enough -> grow
    if (this.stepsSinceGrowth >= this.patience) {
      const improvement = this.validAtLastGrowth - this.validEMA;
      if (improvement < this.minDelta) {
        this.tryGrow();
      } else {
        this.validAtLastGrowth = this.validEMA;
        this.stepsSinceGrowth = 0;
      }
    }

    if (this.steps % 25 === 0) {
      this.history.steps.push(this.steps);
      this.history.train.push(this.trainEMA);
      this.history.valid.push(this.validEMA);
      this.history.params.push(o.paramCount());
      const CAP = 900;
      if (this.history.steps.length > CAP) {
        for (const key of Object.keys(this.history)) this.history[key].splice(0, this.history[key].length - CAP);
      }
    }
    if (this.steps % 150 === 0) {
      this.sample = o.generate("One day, ", 260, this.vocab.stoi, this.vocab.itos, 0.85);
    }
  }

  // Grow the dimension that makes sense next, if the ceiling allows.
  tryGrow() {
    const o = this.org;
    const KSTEPS = [4, 8, 16, 24, 32];
    const HSTEPS = [24, 32, 48, 64, 96, 128, 192, 256];
    const nextK = KSTEPS.find((k) => k > o.K);
    const nextH = HSTEPS.find((h) => h > o.H);
    const est = (K, H) => this.vocab.V * this.E + K * this.E * H + H + H * this.vocab.V + this.vocab.V;

    let choice = null;
    if (nextK !== undefined && nextH !== undefined) {
      choice = (o.K < 16 || o.H >= 64) ? "K" : "H";   // memory first (words), then alternate
    } else if (nextK !== undefined) choice = "K";
    else if (nextH !== undefined) choice = "H";

    if (choice === "K" && est(nextK, o.H) > this.maxParams) choice = nextH !== undefined ? "H" : null;
    if (choice === "H" && est(o.K, nextH) > this.maxParams) choice = nextK !== undefined ? "K" : null;
    if (choice === "K" && est(nextK, o.H) > this.maxParams) choice = null;
    if (choice === "H" && est(o.K, nextH) > this.maxParams) choice = null;

    if (!choice) {
      if (!this.capped) {
        this.capped = true;
        this.log("CEILING", "size ceiling reached at " + o.paramCount() + " params - it keeps learning at full size", "#ffd27c");
      }
      this.validAtLastGrowth = this.validEMA;
      this.stepsSinceGrowth = 0;
      return;
    }

    const oldParams = o.paramCount();
    if (choice === "K") {
      const from = o.K;
      o.growContext(nextK);
      this.log("GROWTH", "longer memory: context " + from + " -> " + nextK + " (" + oldParams + " -> " + o.paramCount() + " params)", "#6ee7ff");
    } else {
      const from = o.H;
      o.growWidth(nextH);
      this.log("GROWTH", "wider brain: " + from + " -> " + nextH + " units (" + oldParams + " -> " + o.paramCount() + " params)", "#6ee7ff");
    }
    o.lr = Math.max(0.012, o.lr * 0.88);
    this.flash = 1;
    this.validAtLastGrowth = this.validEMA;
    this.stepsSinceGrowth = 0;
    this.sample = o.generate("One day, ", 260, this.vocab.stoi, this.vocab.itos, 0.85);
  }

  // Called from the render loop: train for a bounded slice of time.
  step(dt, speed = 1) {
    const budget = Math.min(10 * speed, 60);
    const t0 = performance.now();
    while (performance.now() - t0 < budget) this.trainOneStep();
  }

  // ---- persistence across refreshes ----
  toSave() {
    const o = this.org;
    return {
      v: 1,
      E: this.E, K: o.K, H: o.H, lr: o.lr, growths: o.growths,
      steps: this.steps, trainEMA: this.trainEMA, validEMA: this.validEMA,
      validAtLastGrowth: this.validAtLastGrowth, stepsSinceGrowth: this.stepsSinceGrowth,
      capped: this.capped, history: this.history, sample: this.sample,
      w: { emb: f32ToB64(o.emb), W1: f32ToB64(o.W1), b1: f32ToB64(o.b1), W2: f32ToB64(o.W2), b2: f32ToB64(o.b2) },
    };
  }

  applySave(d) {
    if (!d || d.v !== 1 || !d.w) return false;
    const o = new LinguaOrganism(this.vocab.V, d.E ?? this.E, d.K ?? 2, d.H ?? 16, d.lr ?? 0.06);
    const emb = b64ToF32(d.w.emb, o.emb.length);
    const W1 = b64ToF32(d.w.W1, o.W1.length);
    const b1 = b64ToF32(d.w.b1, o.b1.length);
    const W2 = b64ToF32(d.w.W2, o.W2.length);
    const b2 = b64ToF32(d.w.b2, o.b2.length);
    if (!emb || !W1 || !b1 || !W2 || !b2) return false;
    o.emb.set(emb); o.W1.set(W1); o.b1.set(b1); o.W2.set(W2); o.b2.set(b2);
    o.growths = d.growths ?? 0;
    this.org = o;
    this.E = d.E ?? this.E;
    this.steps = d.steps ?? 0;
    this.trainEMA = d.trainEMA ?? this.trainEMA;
    this.validEMA = d.validEMA ?? this.validEMA;
    this.validAtLastGrowth = d.validAtLastGrowth ?? this.validEMA;
    this.stepsSinceGrowth = d.stepsSinceGrowth ?? 0;
    this.capped = !!d.capped;
    if (d.history && Array.isArray(d.history.steps)) this.history = d.history;
    this.sample = d.sample ?? "";
    this.log("RESTORED", "organism woke up at step " + this.steps +
      " with honest score " + this.validEMA.toFixed(3) + " - progress kept", "#7cffb2");
    return true;
  }

  stats() {
    return {
      steps: this.steps,
      trainLoss: this.trainEMA,
      validLoss: this.validEMA,
      params: this.org.paramCount(),
      K: this.org.K,
      H: this.org.H,
      growths: this.org.growths,
      lr: this.org.lr,
      capped: this.capped,
      sample: this.sample,
    };
  }
}


