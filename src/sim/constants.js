// ============================================================
// PRIMORDIAL - all tunable physics in one place.
// Every number here is a knob you can play with.
// ============================================================

export const WORLD_RADIUS = 30;      // size of the universe (soft wall)
export const VENT_RADIUS = 10;       // how far the nutrient vent's glow reaches
export const HARD_CAP = 700;         // universe density limit (perf guard)
export const SOFT_CAP = 320;         // crowding starts here (upkeep rises)

// Gene layout: the genome is a plain array of floats in [0, 1].
export const GENE = {
  FIDELITY: 0,     // polymerase accuracy. high = faithful copying, low = more mutation
  METABOLISM: 1,   // nutrient uptake style. must MATCH the drifting environment
  EFFICIENCY: 2,   // converts nutrients well, lowers upkeep, costs more to divide
  THRESHOLD: 3,    // energy required before dividing. low = divide early, high = divide rich
  SIZE: 4,         // body size. big = rich children + high upkeep + high division cost
  SPEED: 5,        // swimming speed. fast = reach nutrients, but swimming burns energy
  SENSE: 6,        // ability to steer toward the nutrient vent
  LEARN_RATE: 7,   // the brain's SGD step size. evolves! selection finds a good rate
  BRAIN: 8,        // brain width (hidden units). bigger = smarter potential, but brains are expensive
  PREDATION: 9,    // hunter instinct. high = hunt others, but worse at vent foraging
};
export const GENE_COUNT = 10;
export const GENE_NAMES = [
  "fidelity",
  "metabolism",
  "efficiency",
  "repro threshold",
  "size",
  "speed",
  "sense",
  "learning rate",
  "brain size",
  "predation",
];

// Default universe parameters (mutable live from the UI).
export const DEFAULTS = {
  richness: 1.0,        // nutrient multiplier
  upkeepScale: 1.0,     // global maintenance-cost multiplier
  mutationScale: 1.0,   // global mutation multiplier
  simSpeed: 1.0,        // time multiplier
  baseGain: 18,       // energy per second for a matched organism at the vent
  baseUpkeep: 1.4,      // base maintenance per second
  baseReproCost: 24,    // base energy cost of division
  startEnergy: 60,      // LUCA's inheritance
  envDrift: 0.010,      // how fast the environment's optimum wanders
  speciesThreshold: 0.55, // genome distance at which a child founds a new lineage
  divisionCooldown: 1.1,  // seconds between divisions for one organism
  exploreProb: 0.28,      // chance a mutation is pure exploration instead of informed
  informedBlend: 0.65,    // how strongly informed mutations lean on lineage memory
  brainSignalNoise: 0.12, // noise on the environmental signal the brain must learn
};
