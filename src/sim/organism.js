// ============================================================
// Organism: one cell. It carries a genome (evolves between
// generations) and a brain (learns within this lifetime via
// gradient descent). It swims, eats, pays upkeep, and - when it
// has saved enough energy - reads its OWN genome to build a child.
// ============================================================

import { GENE, WORLD_RADIUS, VENT_RADIUS, HARD_CAP, DEFAULTS } from "./constants.js";
import { copyGenome, genomeDistance, gauss, rng } from "./genome.js";
import { Brain } from "./brain.js";

let nextId = 1;

export class Organism {
  constructor(genome, generation, lineage, pos, parentGenome = null) {
    this.id = nextId++;
    this.genome = genome;
    this.parentGenome = parentGenome;   // kept to credit the founding mutation
    this.generation = generation;
    this.lineage = lineage;
    this.energy = DEFAULTS.startEnergy;
    this.age = 0;
    this.alive = true;
    this.children = 0;
    this.lastRepro = -10;
    this.lastKill = -10;
    this.kills = 0;
    this.credited = false;              // has this organism's mutation been credited?
    this.flash = 0;                     // render pulse on division

    this.pos = pos ?? { x: gauss() * 6, y: gauss() * 6, z: gauss() * 6 };
    this.vel = { x: gauss() * 0.3, y: gauss() * 0.3, z: gauss() * 0.3 };

    // The brain grows from the genome. Bigger brain = more potential
    // skill, but neural tissue is expensive to maintain.
    this.brainWidth = 2 + Math.floor(genome[GENE.BRAIN] * 9); // 2..11
    this.brain = new Brain(this.brainWidth);
    this.learnRate = 0.004 + genome[GENE.LEARN_RATE] * 0.055;
    this.prevSignal = 0.5;
    this.prev2Signal = 0.5;
  }

  step(world, dt) {
    const g = this.genome;

    // --- lifetime learning: one SGD step on the environment signal ---
    const s = world.currentSignal();
    const loss = this.brain.train(this.prev2Signal, this.prevSignal, s, this.learnRate);
    this.prev2Signal = this.prevSignal;
    this.prevSignal = s;
    this.lastLoss = loss;

    // --- movement: steer toward the vent, wander a little ---
    const px = this.pos.x, py = this.pos.y, pz = this.pos.z;
    const dist = Math.sqrt(px * px + py * py + pz * pz) + 1e-6;
    const sense = g[GENE.SENSE];
    const speed = g[GENE.SPEED];
    const pull = sense * 2.4 * Math.min(1, dist / VENT_RADIUS);
    this.vel.x += (-px / dist) * pull * dt + gauss() * 0.55 * dt;
    this.vel.y += (-py / dist) * pull * dt + gauss() * 0.55 * dt;
    this.vel.z += (-pz / dist) * pull * dt + gauss() * 0.55 * dt;
    const damp = Math.exp(-1.7 * dt);
    this.vel.x *= damp; this.vel.y *= damp; this.vel.z *= damp;
    const vmax = 1.2 + speed * 4.5;
    const vlen = Math.sqrt(this.vel.x ** 2 + this.vel.y ** 2 + this.vel.z ** 2) + 1e-9;
    if (vlen > vmax) {
      const k = vmax / vlen;
      this.vel.x *= k; this.vel.y *= k; this.vel.z *= k;
    }
    this.pos.x += this.vel.x * dt * (0.4 + speed);
    this.pos.y += this.vel.y * dt * (0.4 + speed);
    this.pos.z += this.vel.z * dt * (0.4 + speed);
    // soft wall
    const nd = Math.sqrt(this.pos.x ** 2 + this.pos.y ** 2 + this.pos.z ** 2);
    if (nd > WORLD_RADIUS) {
      const k = WORLD_RADIUS / nd;
      this.pos.x *= k; this.pos.y *= k; this.pos.z *= k;
    }

    // --- energy budget ---
    const density = Math.exp(-nd / VENT_RADIUS);                    // 1 at vent -> 0 far away
    const match = 1 - Math.abs(g[GENE.METABOLISM] - world.env.optimum); // environment fit
    const skillBoost = 0.25 + 0.75 * this.brain.skill;              // smart foraging
    // specialization cost: hunters are worse grazers. you can't be
    // perfectly both - this is what keeps the arms race honest.
    const grazePenalty = 1 - 0.35 * g[GENE.PREDATION];
    const gain = Math.pow(Math.max(match, 0), 1.5)
      * (0.35 + g[GENE.EFFICIENCY] * 0.95)
      * skillBoost * density * DEFAULTS.baseGain * world.params.richness * grazePenalty * dt;

    const swimCost = 0.9 * speed * speed + 0.2 * sense;
    const brainCost = 0.05 * this.brainWidth;                       // neural tissue upkeep
    const upkeep = (DEFAULTS.baseUpkeep + g[GENE.SIZE] * 1.5 + swimCost + brainCost)
      * world.params.upkeepScale * world.crowding * dt;

    this.energy += gain - upkeep;
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt * 2.4);

    if (this.energy <= 0) this.alive = false;
  }

  // ------------------------------------------------------------
  // SELF-REPLICATION: pay energy, read our own genome (through
  // the lineage's informed memory), produce a child.
  // ------------------------------------------------------------
  tryReplicate(world) {
    const g = this.genome;
    if (world.organisms.length >= HARD_CAP) return null;
    if (this.age - this.lastRepro < world.params.divisionCooldown) return null;

    const threshold = 45 + g[GENE.THRESHOLD] * 70;
    const cost = DEFAULTS.baseReproCost
      * (0.55 + g[GENE.SIZE] * 0.9)
      * (0.7 + g[GENE.EFFICIENCY] * 0.55);
    if (this.energy < threshold + cost) return null;

    this.energy -= cost;
    this.lastRepro = this.age;
    this.children++;
    this.flash = 1;

    const memory = world.lineages.get(this.lineage) || null;
    const childGenome = copyGenome(g, world.params.mutationScale, memory);

    // speciation: too different from the parent -> found a new lineage
    let childLineage = this.lineage;
    if (genomeDistance(childGenome, g) > world.params.speciesThreshold) {
      childLineage = world.foundLineage();
    }

    const jitter = 1.6;
    const child = new Organism(childGenome, this.generation + 1, childLineage, {
      x: this.pos.x + gauss() * jitter,
      y: this.pos.y + gauss() * jitter,
      z: this.pos.z + gauss() * jitter,
    }, g);
    child.energy = 18 + g[GENE.SIZE] * 30;

    // credit the mutation that MADE this organism once it proves itself
    if (!this.credited && this.parentGenome) {
      world.creditMutation(this);
      this.credited = true;
    }
    return child;
  }
}
