// ============================================================
// Genome utilities. The genome is the creature's DNA: a short
// array of floats. Everything about the creature grows from it.
//
// Mutation here is INFORMED, not blind. Each lineage keeps a
// memory of gene-changes that actually led to reproducing
// descendants, and new mutations lean on that memory. Selection
// still decides who lives - we only made the proposal smarter.
// ============================================================

import { GENE, GENE_COUNT, DEFAULTS } from "./constants.js";

// --- deterministic RNG so runs are reproducible ---
let seed = 1337;
export function reseed(s = 1337) { seed = s >>> 0; }
export function rng() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export function gauss() {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// LUCA: the Last Universal Common Ancestor. One cell, reasonable defaults.
export function seedGenome() {
  const g = new Array(GENE_COUNT).fill(0.5);
  g[GENE.FIDELITY] = 0.86;    // copies itself fairly faithfully... but not perfectly
  g[GENE.METABOLISM] = 0.5;   // matched to the starting environment
  g[GENE.EFFICIENCY] = 0.5;
  g[GENE.THRESHOLD] = 0.42;
  g[GENE.SIZE] = 0.36;
  g[GENE.SPEED] = 0.4;
  g[GENE.SENSE] = 0.5;
  g[GENE.LEARN_RATE] = 0.45;
  g[GENE.BRAIN] = 0.35;
  g[GENE.PREDATION] = 0.08; // LUCA is mostly a grazer, but the door is open
  return g;
}

// ------------------------------------------------------------
// THE SELF-REPLICATION CORE.
// The parent reads its OWN genome to build the child, and the
// accuracy of that reading is itself a gene (FIDELITY). So the
// mutation rate is not a setting we impose - it is a trait the
// creature carries, and it evolves.
//
// `memory` is the lineage's accumulated knowledge of what worked
// (an average of successful gene deltas). When present, the child
// leans on it instead of mutating blindly.
// ------------------------------------------------------------
export function copyGenome(genome, mutScale, memory) {
  const fidelity = clamp01(genome[GENE.FIDELITY]);
  const sigma = (1 - fidelity) * 0.22 * mutScale;
  const child = new Array(GENE_COUNT);

  const informed = memory && memory.count > 0 && rng() > DEFAULTS.exploreProb;

  for (let i = 0; i < GENE_COUNT; i++) {
    let step = gauss() * sigma;                       // blind component
    if (informed) {
      // Pull toward the lineage's "what worked" direction, keep a
      // little noise so we never fully lock in.
      step = step * (1 - DEFAULTS.informedBlend)
           + memory.delta[i] * DEFAULTS.informedBlend * (0.5 + rng())
           + gauss() * sigma * 0.35;
    }
    child[i] = clamp01(genome[i] + step);
  }
  return child;
}

// Euclidean distance between two genomes. Used for speciation:
// a child born too far from its parent founds a new lineage.
export function genomeDistance(a, b) {
  let s = 0;
  for (let i = 0; i < GENE_COUNT; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}
