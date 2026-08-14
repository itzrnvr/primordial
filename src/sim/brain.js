// ============================================================
// The Brain: a tiny MLP that learns ONLINE during the creature's
// lifetime via real gradient descent (manual backprop, no libs).
//
// Task: the environment emits a drifting, noisy signal. The brain
// sees the last two samples and must predict the next one. Its
// prediction skill scales the organism's foraging gain - so being
// able to LEARN is directly worth energy. Evolution therefore
// selects for good learning machinery (the LEARN_RATE and BRAIN
// genes), while gradient descent fills in the weights each life.
// This is the Baldwin-effect half of the hybrid.
// ============================================================

import { gauss } from "./genome.js";

export class Brain {
  constructor(width) {
    this.width = Math.max(2, width);
    // input: last two signal samples -> hidden (tanh) -> output (linear)
    this.w1 = [];           // [width][2]
    this.b1 = new Array(this.width).fill(0);
    this.w2 = new Array(this.width).fill(0);
    this.b2 = 0;
    for (let i = 0; i < this.width; i++) {
      this.w1.push([gauss() * 0.35, gauss() * 0.35]);
      this.w2[i] = gauss() * 0.35;
    }
    this.h = new Array(this.width).fill(0); // hidden activations (cached)
    this.skill = 0.4;                        // moving average of accuracy
  }

  forward(x0, x1) {
    let y = this.b2;
    for (let i = 0; i < this.width; i++) {
      const z = this.w1[i][0] * x0 + this.w1[i][1] * x1 + this.b1[i];
      const a = Math.tanh(z);
      this.h[i] = a;
      y += this.w2[i] * a;
    }
    return y;
  }

  // One SGD step on squared error. Returns the loss.
  train(x0, x1, target, lr) {
    const y = this.forward(x0, x1);
    const err = y - target;
    const loss = err * err;

    // --- backprop ---
    const dy = 2 * err;
    this.b2 -= lr * dy;
    for (let i = 0; i < this.width; i++) {
      const a = this.h[i];
      const dw2 = dy * a;
      const da = dy * this.w2[i];
      const dz = da * (1 - a * a); // tanh'
      this.w2[i] -= lr * dw2;
      this.w1[i][0] -= lr * dz * x0;
      this.w1[i][1] -= lr * dz * x1;
      this.b1[i] -= lr * dz;
    }

    // skill: exponential moving average of accuracy in [0, 1]
    const acc = 1 / (1 + loss * 6);
    this.skill = this.skill * 0.985 + acc * 0.015;
    return loss;
  }
}
