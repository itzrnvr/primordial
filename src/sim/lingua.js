// ============================================================
// LINGUA - one organism that grows from almost nothing into a
// language model.
//
// Its life:
//   1. Born tiny: it sees 2 characters and has 16 brain units.
//   2. It feeds on TinyStories by predicting the next character.
//      Predicting well = learning. Predicting badly = high loss.
//   3. When it stops improving (a plateau), it GROWS: a longer
//      context window (sees more of the past) or a wider brain.
//      Old knowledge is kept - new capacity starts quiet, so
//      growth never erases what it already learned.
//   4. Repeat until it hits the size ceiling. Then it keeps
//      learning at full size.
//
// SENSES (optional, evolved):
//   The genome may switch on extra input "senses" - deterministic
//   features of the raw text that make structure visible:
//     b - boundary sense: 1 where the character is a space
//     p - position sense: how far into the current word we are
//   These are computed from the raw characters at train AND eval
//   time, so they cannot cheat - they only help if seeing word
//   structure genuinely makes the language easier to learn.
//
// All math is manual (typed arrays + loops) so you can read
// every line. No framework.
// ============================================================

// --- private deterministic RNG (separate from the ecosystem) ---
let lseed = 99;
export function linguaReseed(s = 99) { lseed = s >>> 0; }
export function rng() {
  lseed = (lseed * 1664525 + 1013904223) >>> 0;
  return lseed / 4294967296;
}
function gauss() {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// ------------------------------------------------------------
// The organism: a character-level language model.
//   input : the last K characters, each embedded into E numbers,
//           plus (optionally) F sense features per position
//   brain : one hidden layer of H units (tanh)
//   output: probabilities over the next character
// ------------------------------------------------------------
export class LinguaOrganism {
  constructor(V, E, K, H, lr, opts = {}) {
    this.V = V;           // vocabulary size
    this.E = E;           // embedding dimension per character
    this.K = K;           // context window (how many past chars it sees)
    this.H = H;           // brain width (hidden units)
    this.lr = lr;         // learning rate
    this.growths = 0;

    // senses: deterministic input features, evolved, cheat-proof
    this.spaceId = opts.spaceId ?? -1;
    this.fb = !!opts.fb;  // boundary sense (sees spaces)
    this.fp = !!opts.fp;  // position-in-word sense
    this.F = (this.fb ? 1 : 0) + (this.fp ? 1 : 0);

    const F = this.F;
    // weights
    this.emb = new Float32Array(V * E);                 // char -> E numbers
    this.W1 = new Float32Array(K * E * H);              // input -> brain
    this.Wf = new Float32Array(K * F * H);              // senses -> brain
    this.b1 = new Float32Array(H);
    this.W2 = new Float32Array(H * V);                  // brain -> output
    this.b2 = new Float32Array(V);

    const s = 0.35;
    for (let i = 0; i < this.emb.length; i++) this.emb[i] = gauss() * s;
    for (let i = 0; i < this.W1.length; i++) this.W1[i] = gauss() * s / Math.sqrt(K * E);
    for (let i = 0; i < this.Wf.length; i++) this.Wf[i] = gauss() * 0.05;
    for (let i = 0; i < this.W2.length; i++) this.W2[i] = gauss() * s / Math.sqrt(H);
  }

  paramCount() {
    return this.V * this.E + this.K * this.E * this.H + this.K * this.F * this.H + this.H + this.H * this.V + this.V;
  }

  // Sense features for one context row, derived from raw ids.
  // Layout: K rows x F features.
  feats(row, out, off) {
    const { K, fb, fp, spaceId } = this;
    let since = 8;
    for (let k = 0; k < K; k++) {
      const id = row[k];
      let f = 0;
      if (fb) out[off + k * this.F + f++] = id === spaceId ? 1 : 0;
      if (fp) out[off + k * this.F + f++] = Math.min(since, 8) / 8;
      since = id === spaceId ? 0 : since + 1;
    }
  }

  // One training step over a batch.
  // ctx: Int32Array [B * stride] of char ids, tgt: Int32Array [B] next-char ids.
  // Returns the cross-entropy loss. This is the whole organism eating.
  trainBatch(ctx, tgt, B, stride = this.K) {
    const { V, E, K, H, F, emb, W1, Wf, b1, W2, b2, lr } = this;
    const D = K * E;

    // ---- forward ----
    const X = new Float32Array(B * D);          // embedded context
    for (let b = 0; b < B; b++) {
      for (let k = 0; k < K; k++) {
        const id = ctx[b * stride + k];
        const src = id * E;
        const dst = b * D + k * E;
        for (let e = 0; e < E; e++) X[dst + e] = emb[src + e];
      }
    }
    const FX = F ? new Float32Array(B * K * F) : null;   // sense features
    if (F) for (let b = 0; b < B; b++) this.feats(ctx.subarray(b * stride, b * stride + K), FX, b * K * F);

    const H1 = new Float32Array(B * H);         // hidden activations
    for (let b = 0; b < B; b++) {
      for (let j = 0; j < H; j++) {
        let z = b1[j];
        const xb = b * D;
        for (let i = 0; i < D; i++) z += X[xb + i] * W1[i * H + j];
        if (F) {
          const fb0 = b * K * F;
          for (let i = 0; i < K * F; i++) z += FX[fb0 + i] * Wf[i * H + j];
        }
        H1[b * H + j] = Math.tanh(z);
      }
    }
    // logits + softmax + loss
    let loss = 0;
    const dLogits = new Float32Array(B * V);
    for (let b = 0; b < B; b++) {
      let maxZ = -1e30;
      const zs = new Float32Array(V);
      for (let v = 0; v < V; v++) {
        let z = b2[v];
        for (let j = 0; j < H; j++) z += H1[b * H + j] * W2[j * V + v];
        zs[v] = z;
        if (z > maxZ) maxZ = z;
      }
      let sum = 0;
      for (let v = 0; v < V; v++) { zs[v] = Math.exp(zs[v] - maxZ); sum += zs[v]; }
      const t = tgt[b];
      loss += -Math.log(Math.max(zs[t] / sum, 1e-12));
      for (let v = 0; v < V; v++) dLogits[b * V + v] = (zs[v] / sum - (v === t ? 1 : 0)) / B;
    }

    // ---- backward ----
    const dW2 = new Float32Array(H * V);
    const db2 = new Float32Array(V);
    const dH1 = new Float32Array(B * H);
    for (let b = 0; b < B; b++) {
      for (let v = 0; v < V; v++) {
        const g = dLogits[b * V + v];
        db2[v] += g;
        for (let j = 0; j < H; j++) {
          dW2[j * V + v] += H1[b * H + j] * g;
          dH1[b * H + j] += W2[j * V + v] * g;
        }
      }
    }
    const dW1 = new Float32Array(D * H);
    const dWf = F ? new Float32Array(K * F * H) : null;
    const db1 = new Float32Array(H);
    const dX = new Float32Array(B * D);
    for (let b = 0; b < B; b++) {
      for (let j = 0; j < H; j++) {
        const h = H1[b * H + j];
        let g = dH1[b * H + j] * (1 - h * h);   // tanh derivative
        db1[j] += g;
        for (let i = 0; i < D; i++) {
          dW1[i * H + j] += X[b * D + i] * g;
          dX[b * D + i] += W1[i * H + j] * g;
        }
        if (F) {
          const fb0 = b * K * F;
          for (let i = 0; i < K * F; i++) dWf[i * H + j] += FX[fb0 + i] * g;
        }
      }
    }

    // ---- SGD update ----
    for (let i = 0; i < W2.length; i++) W2[i] -= lr * dW2[i];
    for (let i = 0; i < b2.length; i++) b2[i] -= lr * db2[i];
    for (let i = 0; i < W1.length; i++) W1[i] -= lr * dW1[i];
    if (F) for (let i = 0; i < Wf.length; i++) Wf[i] -= lr * dWf[i];
    for (let i = 0; i < b1.length; i++) b1[i] -= lr * db1[i];
    for (let b = 0; b < B; b++) {
      for (let k = 0; k < K; k++) {
        const id = ctx[b * stride + k];
        for (let e = 0; e < E; e++) emb[id * E + e] -= lr * dX[b * D + k * E + e];
      }
    }
    return loss / B;
  }

  // Forward only, for one context row. Returns softmax probabilities.
  predict(row) {
    const { V, E, K, H, F, emb, W1, Wf, b1, W2, b2 } = this;
    const D = K * E;
    const x = new Float32Array(D);
    for (let k = 0; k < K; k++) {
      const id = row[k];
      for (let e = 0; e < E; e++) x[k * E + e] = emb[id * E + e];
    }
    const fx = F ? new Float32Array(K * F) : null;
    if (F) this.feats(row, fx, 0);
    const h = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let z = b1[j];
      for (let i = 0; i < D; i++) z += x[i] * W1[i * H + j];
      if (F) for (let i = 0; i < K * F; i++) z += fx[i] * Wf[i * H + j];
      h[j] = Math.tanh(z);
    }
    const zs = new Float32Array(V);
    let maxZ = -1e30;
    for (let v = 0; v < V; v++) {
      let z = b2[v];
      for (let j = 0; j < H; j++) z += h[j] * W2[j * V + v];
      zs[v] = z;
      if (z > maxZ) maxZ = z;
    }
    let sum = 0;
    for (let v = 0; v < V; v++) { zs[v] = Math.exp(zs[v] - maxZ); sum += zs[v]; }
    for (let v = 0; v < V; v++) zs[v] /= sum;
    return zs;
  }

  // ------------------------------------------------------------
  // GROWTH. The organism gets bigger WITHOUT forgetting: old
  // weights are copied over untouched, and the new parts start
  // nearly silent, so behaviour is preserved at the moment of
  // growth. Learning then wakes the new capacity up.
  // ------------------------------------------------------------
  growContext(newK) {
    const { E, H, K, F } = this;
    const oldD = K * E;
    const newD = newK * E;
    const addD = newD - oldD;
    const W1n = new Float32Array(newD * H);
    // new (older) context slots come first and start quiet
    for (let i = 0; i < addD; i++)
      for (let j = 0; j < H; j++) W1n[i * H + j] = gauss() * 0.01;
    // old context keeps its exact knowledge
    for (let i = 0; i < oldD; i++)
      for (let j = 0; j < H; j++) W1n[(i + addD) * H + j] = this.W1[i * H + j];
    this.W1 = W1n;
    if (F) {
      const oldS = K * F, newS = newK * F, addS = newS - oldS;
      const Wfn = new Float32Array(newS * H);
      for (let i = 0; i < addS; i++)
        for (let j = 0; j < H; j++) Wfn[i * H + j] = gauss() * 0.01;
      for (let i = 0; i < oldS; i++)
        for (let j = 0; j < H; j++) Wfn[(i + addS) * H + j] = this.Wf[i * H + j];
      this.Wf = Wfn;
    }
    this.K = newK;
    this.growths++;
  }

  growWidth(newH) {
    const { V, K, E, H, F } = this;
    const D = K * E;
    const addH = newH - H;
    const W1n = new Float32Array(D * newH);
    const b1n = new Float32Array(newH);
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < H; j++) W1n[i * newH + j] = this.W1[i * H + j];
      for (let j = 0; j < addH; j++) W1n[i * newH + H + j] = gauss() * 0.01;
    }
    for (let j = 0; j < H; j++) b1n[j] = this.b1[j];
    for (let j = 0; j < addH; j++) b1n[H + j] = 0.01;
    const W2n = new Float32Array(newH * V);
    for (let j = 0; j < H; j++)
      for (let v = 0; v < V; v++) W2n[j * V + v] = this.W2[j * V + v];
    for (let j = 0; j < addH; j++)
      for (let v = 0; v < V; v++) W2n[(H + j) * V + v] = gauss() * 0.01;
    let Wfn = null;
    if (F) {
      const S = K * F;
      Wfn = new Float32Array(S * newH);
      for (let i = 0; i < S; i++) {
        for (let j = 0; j < H; j++) Wfn[i * newH + j] = this.Wf[i * H + j];
        for (let j = 0; j < addH; j++) Wfn[i * newH + H + j] = gauss() * 0.01;
      }
    }
    this.W1 = W1n; this.b1 = b1n; this.W2 = W2n;
    if (Wfn) this.Wf = Wfn;
    this.H = newH;
    this.growths++;
  }

  // Produce text: sample one character at a time from its own
  // predictions. This is how you hear what it has learned.
  generate(seedText, nChars, stoi, itos, temperature = 0.8) {
    const K = this.K;
    const ids = [];
    for (const ch of seedText) {
      if (stoi[ch] !== undefined) ids.push(stoi[ch]);
    }
    let out = seedText;
    for (let n = 0; n < nChars; n++) {
      const row = new Int32Array(K);
      for (let k = 0; k < K; k++) {
        const idx2 = ids.length - K + k;
        row[k] = idx2 >= 0 ? ids[idx2] : 0;
      }
      const probs = this.predict(row);
      // temperature sampling: lower temperature = more confident
      let sum = 0;
      const adj = new Float32Array(this.V);
      for (let v = 0; v < this.V; v++) {
        adj[v] = Math.pow(probs[v], 1 / temperature);
        sum += adj[v];
      }
      let r = rng() * sum;
      let pick = 0;
      for (let v = 0; v < this.V; v++) {
        r -= adj[v];
        if (r <= 0) { pick = v; break; }
      }
      ids.push(pick);
      out += itos[pick];
    }
    return out;
  }
}


