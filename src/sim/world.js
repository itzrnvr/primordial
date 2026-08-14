// ============================================================
// World: the universe. Holds the population, the drifting
// environment, lineage memories (the informed-mutation knowledge
// base), and the event/history streams the UI renders.
// ============================================================

import { GENE, GENE_COUNT, DEFAULTS, SOFT_CAP, HARD_CAP } from "./constants.js";
import { Organism } from "./organism.js";
import { seedGenome, reseed, gauss, rng } from "./genome.js";

export class World {
  constructor() {
    this.reset();
  }

  reset() {
    reseed(1337);
    this.time = 0;
    this.organisms = [];
    this.events = [];
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.maxGeneration = 0;
    this.nextLineageId = 1;
    this.lineages = new Map();          // lineageId -> { delta[], count }
    this.params = { ...DEFAULTS };
    this.env = { optimum: 0.5 };
    this.crowding = 1;
    this.milestones = new Set();
    this.recordAge = 0;        // longest any cell has ever lived
    this.recordChildren = 0;   // most children any cell has ever had

    // the learnable signal: drifting sines + noise. The predictable
    // part is what brains can learn; the noise sets the floor.
    this.signalPhase = rng() * 6.28;
    this.signalValue = 0.5;

    this.history = { t: [], pop: [], fidelity: [], metabolism: [], skill: [], optimum: [], lineages: [] };
    this.lastSample = -1;

    const luca = new Organism(seedGenome(), 0, 0, { x: 0, y: 0, z: 5 });
    this.organisms.push(luca);
    this.log("GENESIS", "LUCA awakens near the vent", "#7cffb2");
  }

  log(type, msg, color = "#9fb4d8") {
    this.events.push({ t: this.time, type, msg, color });
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  foundLineage() {
    const id = this.nextLineageId++;
    return id;
  }

  lineageMemory(lineageId) {
    if (!this.lineages.has(lineageId)) {
      this.lineages.set(lineageId, { delta: new Array(GENE_COUNT).fill(0), count: 0 });
    }
    return this.lineages.get(lineageId);
  }

  // Informed mutation bookkeeping: an organism whose founding mutation
  // led to reproduction teaches its lineage "this direction worked".
  creditMutation(org) {
    if (!org.parentGenome) return;
    const mem = this.lineageMemory(org.lineage);
    const weight = 1 / (1 + mem.count * 0.12); // decay so old history fades
    for (let i = 0; i < GENE_COUNT; i++) {
      const d = org.genome[i] - org.parentGenome[i];
      mem.delta[i] = mem.delta[i] * (1 - weight) + d * weight;
    }
    mem.count++;
  }

  currentSignal() {
    return this.signalValue;
  }

  advanceSignal(dt) {
    const t = this.time;
    const clean = 0.5
      + 0.24 * Math.sin(t * 0.85 + this.signalPhase)
      + 0.13 * Math.sin(t * 2.17 + this.signalPhase * 1.7);
    this.signalValue = clean + gauss() * DEFAULTS.brainSignalNoise;
  }

  step(dt) {
    this.time += dt;

    // --- environment drifts: the metabolic optimum wanders ---
    this.env.optimum += gauss() * this.params.envDrift * Math.sqrt(dt) * 3.2;
    this.env.optimum = Math.min(0.88, Math.max(0.12, this.env.optimum));
    this.env.richness = 1 + 0.22 * Math.sin(this.time * 0.045); // seasons

    this.advanceSignal(dt);

    const n = this.organisms.length;
    const over = Math.max(0, (n - SOFT_CAP) / SOFT_CAP);
    this.crowding = 1 + over * over * 2.2;

    // --- live, eat, maybe die ---
    this.applySeparation(dt);
    for (const o of this.organisms) o.step(this, dt);
    for (const o of this.organisms) {
      if (!o.alive && o.age > this.recordAge) this.recordAge = o.age;
      if (o.children > this.recordChildren) this.recordChildren = o.children;
    }
    const before = this.organisms.length;
    this.organisms = this.organisms.filter((o) => o.alive);
    const deaths = before - this.organisms.length;
    this.totalDeaths += deaths;

    // --- maybe divide ---
    const births = [];
    for (const o of this.organisms) {
      const child = o.tryReplicate(this);
      if (child) {
        births.push(child);
        if (child.lineage !== o.lineage) {
          this.milestone("spec" + child.lineage, "lineage #" + child.lineage + " founded (speciation)", "#d99cff");
        }
      }
    }
    if (births.length) {
      this.organisms.push(...births);
      this.totalBirths += births.length;
      for (const c of births) {
        if (c.generation > this.maxGeneration) {
          this.maxGeneration = c.generation;
          this.milestone("gen" + c.generation, "first generation-" + c.generation + " organism", "#ffd27c");
        }
      }
    }

    // --- predation: the adversarial (GAN-like) arms race ---
    this.applyPredation(dt);

    // --- population milestones ---
    this.milestonePop(50); this.milestonePop(150); this.milestonePop(300); this.milestonePop(600);

    // --- story milestones ---
    for (const o of this.organisms) {
      if (o.genome[GENE.PREDATION] > 0.55) {
        this.milestone("hunter", "the first hunter evolved - red cells now eat other cells", "#ff9c6e");
        break;
      }
    }
    if (this.organisms.length > 30) {
      const counts = new Map();
      for (const o of this.organisms) counts.set(o.lineage, (counts.get(o.lineage) || 0) + 1);
      let topId = -1, topN = 0;
      for (const [id, c] of counts) if (c > topN) { topN = c; topId = id; }
      if (topN / this.organisms.length > 0.6) {
        this.milestone("dom" + topId, "family #" + topId + " now dominates - " + Math.round((topN / this.organisms.length) * 100) + "% of all life", "#d99cff");
      }
    }
    const cycle = Math.floor(this.time / 140);
    if ((this.env.richness ?? 1) < 0.85) this.milestone("lean" + cycle, "a lean season began - food is scarce", "#ffd27c");

    // --- history sampling for the charts ---
    if (this.time - this.lastSample > 0.5) {
      this.lastSample = this.time;
      this.sampleHistory();
    }
  }

  // ------------------------------------------------------------
  // PREDATION: the adversarial half of the universe. Hunters
  // (high PREDATION gene) stalk other cells; prey escape with
  // their learned brains. Attack = hunter skill, defense = prey
  // skill, so neither side ever settles - an arms race, which is
  // the ecological version of a GAN. A spatial hash keeps it cheap.
  // ------------------------------------------------------------
  applyPredation(dt) {
    const cellSize = 4;
    const cells = new Map();
    const keyOf = (x, y, z) =>
      Math.floor(x / cellSize) + "," + Math.floor(y / cellSize) + "," + Math.floor(z / cellSize);
    for (const o of this.organisms) {
      const k = keyOf(o.pos.x, o.pos.y, o.pos.z);
      let arr = cells.get(k);
      if (!arr) { arr = []; cells.set(k, arr); }
      arr.push(o);
    }
    for (const pred of this.organisms) {
      const hunt = pred.genome[GENE.PREDATION];
      if (hunt < 0.3) continue;                      // grazers don't chase
      if (this.time - pred.lastKill < 1.8) continue; // still digesting
      const cx = Math.floor(pred.pos.x / cellSize);
      const cy = Math.floor(pred.pos.y / cellSize);
      const cz = Math.floor(pred.pos.z / cellSize);
      const reach = 1.1 + pred.genome[GENE.SPEED] * 1.3;
      let caught = false;
      for (let dx = -1; dx <= 1 && !caught; dx++)
      for (let dy = -1; dy <= 1 && !caught; dy++)
      for (let dz = -1; dz <= 1 && !caught; dz++) {
        const arr = cells.get((cx + dx) + "," + (cy + dy) + "," + (cz + dz));
        if (!arr) continue;
        for (const prey of arr) {
          if (prey === pred || !prey.alive) continue;
          if (prey.genome[GENE.PREDATION] >= hunt) continue; // never pick a fight with a bigger hunter
          const rx = prey.pos.x - pred.pos.x;
          const ry = prey.pos.y - pred.pos.y;
          const rz = prey.pos.z - pred.pos.z;
          if (rx * rx + ry * ry + rz * rz > reach * reach) continue;
          const attack = (0.25 + 0.75 * pred.brain.skill) * hunt;
          const evade = 0.7 * prey.brain.skill + 0.3 * prey.genome[GENE.SPEED];
          const prob = Math.min(0.9, Math.max(0.02, attack - evade * 0.75)) * dt * 3;
          if (rng() < prob) {
            const stolen = prey.energy * 0.6;
            prey.energy -= stolen;
            pred.energy += 10 + stolen * 0.5;
            pred.lastKill = this.time;
            pred.kills++;
            pred.flash = 1;
            prey.flash = 0.6;
            if (prey.energy <= 0) prey.alive = false;
            if (rng() < 0.08) this.log("PREDATION", "organism #" + pred.id + " caught #" + prey.id, "#ff9c6e");
            caught = true;
            break;
          }
        }
      }
    }
    for (const o of this.organisms) {
      if (!o.alive && o.age > this.recordAge) this.recordAge = o.age;
    }
    const beforeP = this.organisms.length;
    this.organisms = this.organisms.filter((o) => o.alive);
    this.totalDeaths += beforeP - this.organisms.length;
  }

  // ------------------------------------------------------------
  // SEPARATION: cells gently push apart so the swarm stays
  // readable instead of collapsing into one blob at the vent.
  // Same spatial-hash trick as predation.
  // ------------------------------------------------------------
  applySeparation(dt) {
    const cellSize = 2.4;
    const cells = new Map();
    const keyOf = (x, y, z) =>
      Math.floor(x / cellSize) + "," + Math.floor(y / cellSize) + "," + Math.floor(z / cellSize);
    for (const o of this.organisms) {
      const k = keyOf(o.pos.x, o.pos.y, o.pos.z);
      let arr = cells.get(k);
      if (!arr) { arr = []; cells.set(k, arr); }
      arr.push(o);
    }
    const R = 1.9, push = 3.2;
    for (const o of this.organisms) {
      let fx = 0, fy = 0, fz = 0;
      const cx = Math.floor(o.pos.x / cellSize);
      const cy = Math.floor(o.pos.y / cellSize);
      const cz = Math.floor(o.pos.z / cellSize);
      for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const arr = cells.get((cx + dx) + "," + (cy + dy) + "," + (cz + dz));
        if (!arr) continue;
        for (const q of arr) {
          if (q === o) continue;
          const rx = o.pos.x - q.pos.x;
          const ry = o.pos.y - q.pos.y;
          const rz = o.pos.z - q.pos.z;
          const d2 = rx * rx + ry * ry + rz * rz;
          if (d2 > R * R || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const f = (R - d) / (R * d);
          fx += rx * f; fy += ry * f; fz += rz * f;
        }
      }
      o.vel.x += fx * push * dt;
      o.vel.y += fy * push * dt;
      o.vel.z += fz * push * dt;
    }
  }

  milestonePop(n) {
    if (this.organisms.length >= n) {
      this.milestone("pop" + n, "life is spreading - " + n + " cells alive", "#7cc4ff");
    }
  }

  milestone(key, msg, color) {
    if (this.milestones.has(key)) return;
    this.milestones.add(key);
    this.log("MILESTONE", msg, color);
  }

  sampleHistory() {
    const orgs = this.organisms;
    const n = orgs.length || 1;
    let fid = 0, met = 0, skill = 0;
    for (const o of orgs) {
      fid += o.genome[GENE.FIDELITY];
      met += o.genome[GENE.METABOLISM];
      skill += o.brain.skill;
    }
    const H = this.history;
    H.t.push(this.time);
    H.pop.push(orgs.length);
    H.fidelity.push(fid / n);
    H.metabolism.push(met / n);
    H.skill.push(skill / n);
    H.optimum.push(this.env.optimum);
    H.lineages.push(this.nextLineageId);
    const CAP = 720;
    if (H.t.length > CAP) {
      for (const k of Object.keys(H)) H[k].splice(0, H[k].length - CAP);
    }
  }

  meteor(fraction = 0.45) {
    const orgs = this.organisms;
    const killCount = Math.floor(orgs.length * fraction);
    for (let i = 0; i < killCount; i++) {
      const idx = Math.floor(rng() * orgs.length);
      orgs[idx].alive = false;
    }
    this.organisms = orgs.filter((o) => o.alive);
    this.totalDeaths += killCount;
    this.log("EXTINCTION", `meteor strike - ${killCount} organisms gone`, "#ff7c7c");
  }

  stats() {
    const orgs = this.organisms;
    const n = orgs.length || 1;
    let fid = 0, met = 0, skill = 0, energy = 0, best = null;
    let hunters = 0, starving = 0;
    let oldest = null, topParent = null, ageSum = 0;
    const counts = new Map();
    for (const o of orgs) {
      fid += o.genome[GENE.FIDELITY];
      met += o.genome[GENE.METABOLISM];
      skill += o.brain.skill;
      energy += o.energy;
      ageSum += o.age;
      if (!oldest || o.age > oldest.age) oldest = o;
      if (!topParent || o.children > topParent.children) topParent = o;
      if (!best || o.brain.skill > best.brain.skill) best = o;
      if (o.genome[GENE.PREDATION] > 0.5) hunters++;
      if (o.energy < 20) starving++;
      counts.set(o.lineage, (counts.get(o.lineage) || 0) + 1);
    }
    const lineageShares = [...counts.entries()]
      .map(([id, count]) => ({ id, count, share: count / n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const richness = this.env.richness ?? 1;
    const season = richness > 1.1 ? "good season (plenty of food)"
      : richness < 0.9 ? "lean season (food is scarce)"
      : "normal season";
    return {
      pop: orgs.length,
      births: this.totalBirths,
      deaths: this.totalDeaths,
      maxGeneration: this.maxGeneration,
      lineages: this.nextLineageId,
      avgFidelity: fid / n,
      avgMetabolism: met / n,
      avgSkill: skill / n,
      avgEnergy: energy / n,
      optimum: this.env.optimum,
      richness,
      season,
      hunters,
      starving,
      lineageShares,
      crowding: this.crowding,
      best,
      time: this.time,
      avgAge: ageSum / n,
      oldestAge: oldest ? oldest.age : 0,
      oldestId: oldest ? oldest.id : null,
      topChildren: topParent ? topParent.children : 0,
      topParentId: topParent ? topParent.id : null,
      recordAge: Math.max(this.recordAge, oldest ? oldest.age : 0),
      recordChildren: Math.max(this.recordChildren, topParent ? topParent.children : 0),
    };
  }
}

export const world = new World();
