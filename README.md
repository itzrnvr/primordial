# PRIMORDIAL

A digital origin-of-life simulator with three modes, live in 3D in your
browser:

1. **ecosystem** — cells evolve around a hydrothermal vent: replication,
   mutation, selection, predation, lineage memory.
2. **organism** — one creature grows from almost nothing into a language
   model that eats TinyStories.
3. **evolution** — a population of language organisms. Evolution discovers
   the architecture; gradient descent does the learning.

The long-term goal: the smallest, most efficient model that produces
coherent TinyStories — with the architecture and learning loop *discovered
by evolution*, not hand-designed. We design the physics and the ceilings;
the answer evolves.

## The hybrid: evolution + gradient descent

Pure evolution is hopeless in high dimensions: black-box search converges at
best at O(1/d) in the number of tunable numbers d, and "this child failed"
carries almost no information when d is a million weights. So this project
splits the work the way biology does:

- **Evolution** searches a tiny, low-dimensional genome. Failures stay
  informative because d is small.
- **Gradient descent** trains the weights inside each organism's lifetime.
  This is the Baldwin effect: evolution selects good learning machinery;
  learning fills in the details each life.

In **evolution mode** the genome is only 4 numbers:

- `K` — context: how many past characters it sees
- `E` — embedding: size of each character's internal code
- `H` — brain width (hidden units)
- `lr` — learning rate

Each creature lives a fixed training budget (next-character prediction on
TinyStories), then is scored on stories it NEVER trained on (the honest
score; random guessing = ln(70) = 4.25). The two best are reborn as elites;
the rest of the next generation are mutated/recombined children of the best.
Mutation is informed (recombination of proven archive genomes + small
nudges) but keeps rare full-random jumps: jumps are how search escapes local
optima. Evolution never touches the weights.

Progress autosaves to the browser's localStorage every few seconds and on refresh: the champion's weights, its score, the generation history and your active mode all survive a page reload. The reset buttons clear the save and start truly fresh. (The ecosystem mode still starts fresh by design - it regrows in seconds.)

Headless verification (5 creatures, 220-step lifetimes, 6 generations):
generation 1 best 2.864 -> generation 3 best 2.609, winning genome
K32/E16/H96/lr0.19 — evolution discovered that long memory matters before
width. `node work/evolve_test.mjs` reproduces it (needs the TinyStories
slices in `public/data/`).

## The ecosystem mode

The original universe. Evolution needs a trio — replication, imperfect
copying, differential success — and here replication accuracy is itself a
gene (`fidelity`), so the mutation rate evolves. Mutation is informed:
lineages remember gene changes that produced reproducing descendants and
lean on that memory (with exploration). Selection still decides who lives —
the proposal distribution is just smarter than a coin flip, the same
intuition behind archive-based evolutionary systems (Darwin Godel Machine,
AC/DC) where informed operators and empirical validation gates do the heavy
lifting.

A GAN-like arms race lives here too: hunters (high `predation` gene) chase
prey; attack and defense both run through the learned brains, so neither
side settles (Red Queen). The environment's optimum drifts, seasons
oscillate, crowding raises upkeep — carrying capacity emerges instead of
being imposed.

## The organism mode

One character-level language model born tiny (sees 2 characters, 16 brain
units, ~2.8K params). It feeds on TinyStories by predicting the next
character; when it plateaus it GROWS — longer memory or wider brain — with
new capacity starting near-silent so growth never erases learned knowledge.
All math is manual typed-array code; no framework.

## Running it

```bash
npm install
npm run dev      # open http://localhost:5173
npm run build    # production build in dist/
npm test         # ecosystem smoke test
node work/evolve_test.mjs   # headless evolution check
```

## Controls

- Drag to orbit, scroll to zoom; ecosystem: click a cell to inspect.
- `space` pause - `m` meteor - `r` reset (ecosystem).
- Every slider has a hover tooltip explaining what it does in plain words.

## Project layout

```
src/
  sim/            the physics - pure JS, no framework
    constants.js    every ecosystem tunable in one place
    genome.js       ecosystem DNA, informed mutation, lineage memory
    brain.js        tiny MLP with manual backprop (lifetime learning)
    organism.js     one cell: swim, eat, learn, divide
    world.js        ecology, drift, predation, events
    lingua.js       the language organism (manual forward/backward)
    lingua-world.js organism-mode life: feed, watch, grow
    evolve.js       evolution mode: genomes, breeding, honest scoring
    *-runtime.js    browser loaders for the TinyStories slices
  render/         Three.js via react-three-fiber
    Scene.jsx SimDriver.jsx Vent.jsx Organisms.jsx GrowingCell.jsx
    Population.jsx  the evolving ring of language organisms
  ui/             HUDs, charts, controls, event feed, inspector
  state/          zustand store bridging sim and React
public/data/      TinyStories train/valid slices (~6 MB / ~1.5 MB)
```

## Roadmap

- [x] Ecosystem with informed mutation, lifetime learning, arms race
- [x] Organism mode: one creature grows into a language model
- [x] Evolution mode: population discovers the 4-number genome
- [ ] Efficiency ceilings: FLOP/param budgets as kill rules, quality-vs-size
      Pareto, matched 1M-param dense TinyStories baseline
- [ ] Evolve the learning rule: per-layer update masks / learning rates,
      then optimizer and curriculum choices
- [ ] Local LLM as an informed mutation proposer (constrained, archive-aware)
      alongside random jumps - never replacing them
- [ ] Task coevolution: varied/perturbed held-out challenges against
      memorization (AC/DC-style coverage)

## Design principles

- No mysticism, no metaphor-rebranding. Plain mechanics, measured.
- Honest scoring only: unseen stories, never training loss.
- Anything predefined is listed in one place, and the roadmap exists to
  shrink that list.

