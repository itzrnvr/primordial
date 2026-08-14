# PRIMORDIAL

A digital origin-of-life simulator. One cell wakes up near a hydrothermal vent,
reads its own genome to copy itself, and its descendants evolve — live, in 3D,
in your browser.

The goal: discover the smallest, most efficient organism that thrives in this
universe, under hard ceilings on energy and resources. We do not design the
answer. We design the physics, and let the answer evolve.

## The three laws of this universe

Evolution needs a trio. Remove any one and nothing adapts:

1. **Replication** — organisms copy themselves.
2. **Imperfect copying** — every copy has errors. No errors, no novelty.
3. **Differential success** — some copies survive and reproduce more than others.

Here, replication is a *trait*, not a free feature: the accuracy of copying is
itself a gene (`fidelity`). The mutation rate evolves. Cross the error
threshold and lineages dissolve into noise; sit below it and they stagnate.
The population finds the edge on its own.

## The hybrid: evolution + gradient descent

Pure evolution is hopeless in high dimensions — the failure state of an
offspring ("it didn't beat its parent") carries very little information, and
black-box search converges at best at O(1/d) in the number of dimensions d.
So this project splits the work the way biology does:

- **Evolution** acts on the **genome**: 9 low-dimensional genes (fidelity,
  metabolism, efficiency, reproduction threshold, size, speed, sense,
  learning rate, brain size). Low-dimensional, so failures stay informative.
- **Gradient descent** acts on the **brain**: each organism grows a tiny
  neural network from its genes and trains it *online during its lifetime*
  with real backpropagation, learning to predict the environment's drifting
  signal. Prediction skill multiplies foraging gain — being able to learn is
  directly worth energy. This is the Baldwin effect: evolution selects for
  good learning machinery; learning fills in the details each life.

## Mutation is informed, not blind

Each lineage keeps a memory of gene-changes that actually produced
descendants which went on to reproduce. New mutations lean on that memory
(with a healthy dose of exploration). Selection still decides who lives —
the proposal distribution is simply smarter than a coin flip. This is the
same intuition behind modern evolutionary systems like AlphaEvolve, where
informed mutation operators do the heavy lifting.

## The arms race (GAN-like)

A GAN is two networks locked in an arms race: one generates tricks, the other
learns to see through them. The ecological version lives here too. Cells with a
high `predation` gene hunt other cells; prey escape using their learned brains.
Attack strength = hunter brain skill, defense = prey brain skill, so neither
side ever settles. Hunters pay a cost (they graze worse at the vent), so
predation only spreads when it actually pays. Watch for the red-tinted cells.
This keeps selection pressure alive long after the environment alone would
stabilize - the Red Queen effect.

## The ecology

- A glowing **vent** radiates nutrients; density falls off with distance.
- The environment has a drifting **optimum**: each organism's `metabolism`
  gene must match it. Watch the adaptation chart — the population's average
  gene chases the drifting optimum. That is natural selection, rendered.
- Everything has a cost: swimming burns energy, neural tissue burns energy,
  big bodies burn energy. Division costs energy. Crowding raises upkeep, so
  carrying capacity emerges instead of being imposed.
- Seasons: nutrient richness slowly oscillates.

## Running it

```bash
npm install
npm run dev      # open http://localhost:5173
npm run build    # production build in dist/
```

## Controls

- Drag to orbit, scroll to zoom, click a cell to inspect its genome.
- `space` pause - `m` meteor (kill 45%, watch recovery) - `r` reset.
- Sliders: sim speed, mutation scale, nutrient richness, upkeep (hardness),
  environment drift. All take effect live.

## Project layout

```
src/
  sim/            the physics - pure JS, no framework
    constants.js    every tunable number in one place
    genome.js       DNA, self-replication, informed mutation, RNG
    brain.js        tiny MLP with manual backprop (lifetime learning)
    organism.js     one cell: swim, eat, learn, divide
    world.js        ecology, environment drift, lineage memory, events
  render/         Three.js via react-three-fiber
    Scene.jsx       canvas, lights, bloom, camera
    SimDriver.jsx   steps the sim from the render loop
    Vent.jsx        the sun of this universe
    Organisms.jsx   one instanced mesh for the whole population
  ui/             HUD, charts, controls, event feed, genome inspector
  state/          zustand store bridging sim and React
```

## Experiment plan (honest baselines first)

Claims in this project must beat baselines:

1. **Blind EA** — same genome, but mutation is pure Gaussian noise
   (informed memory disabled). Does lineage memory actually help?
2. **Hill climbing with random restarts** — the classic "often beats EA"
   baseline. Does evolution + memory beat it on the genome landscape?
3. **Brain ablation** — set brain skill to a constant. How much does
   lifetime learning actually contribute to fitness?

Measurements: held-out fitness over time, best/avg genome trajectories,
lineage diversity, and recovery curves after meteor strikes.

## Roadmap

- [ ] Baseline harness (above) with seeded, reproducible runs
- [ ] Genome logging to JSONL for offline analysis
- [ ] Structural genome: genes that grow new modules, not just tune knobs
- [ ] Swap the signal-prediction exam for a real sequence-prediction task
      (a step toward the TinyStories goal)

## Design principles

- No mysticism, no metaphor-rebranding. Plain mechanics, measured.
- Every ceiling is real physics (energy, crowding), not an arbitrary cap.
- Anything predefined is listed in `constants.js` and nothing else.
