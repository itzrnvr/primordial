import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { GENE_NAMES } from "../sim/constants.js";

// Plain-language explanations, one per gene, shown on hover.
const GENE_HELP = [
  "Copying accuracy. Lower = children differ more from the parent (more mutation).",
  "Diet setting. Must match the environment's current comfort zone or the cell eats poorly.",
  "How well food converts into energy. Efficient cells waste less.",
  "How much energy the cell saves before splitting. Lower = splits sooner.",
  "Body size. Bigger cells give children a head start but cost more to keep alive.",
  "Swimming speed. Fast cells reach food sooner but burn energy swimming.",
  "How well the cell steers toward the vent's glow.",
  "How fast its brain learns from experience during its life.",
  "Brain size. More thinking power, but brain tissue is expensive.",
  "Hunting instinct. High = eats other cells, but grazes worse at the vent.",
];

// Click any cell to inspect its genome, age and lineage.
export default function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  useStore((s) => s.uiTick);
  const o = world.organisms.find((x) => x.id === selectedId);
  if (!o) return null;

  return (
    <div className="inspector panel">
      <div className="panel-title">cell #{o.id} <span className="gen">generation {o.generation} · family #{o.lineage}</span></div>
      <div className="ins-row" title="How long this cell has been alive"><span>age</span><b>{o.age.toFixed(1)}s</b></div>
      <div className="ins-row" title="Energy left. Save enough and the cell splits. Hit 0 and it dies."><span>energy</span><b>{o.energy.toFixed(1)}</b></div>
      <div className="ins-row" title="How many children this cell has produced"><span>children</span><b>{o.children}</b></div>
      <div className="ins-row" title="How well this cell's brain predicts food. Higher = it eats up to 4x more."><span>foresight</span><b>{(o.brain.skill * 100).toFixed(0)}%</b></div>
      <div className="genome">
        {o.genome.map((v, i) => (
          <div className="gene" key={i} title={GENE_HELP[i]}>
            <span className="gene-name">{GENE_NAMES[i]}</span>
            <div className="gene-bar"><div className="gene-fill" style={{ width: (v * 100).toFixed(1) + "%" }} /></div>
            <span className="gene-val">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="gene-hint">hover a gene to learn what it does</div>
    </div>
  );
}
