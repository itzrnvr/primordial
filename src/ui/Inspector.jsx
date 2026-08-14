import { useStore } from "../state/store.js";
import { world } from "../sim/world.js";
import { GENE_NAMES } from "../sim/constants.js";

// Click any cell to inspect its genome, energy and lineage.
export default function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  useStore((s) => s.uiTick);
  const o = world.organisms.find((x) => x.id === selectedId);
  if (!o) return null;

  return (
    <div className="inspector panel">
      <div className="panel-title">
        organism #{o.id} <span className="gen">gen {o.generation}</span>
      </div>
      <div className="ins-row"><span>energy</span><b>{o.energy.toFixed(1)}</b></div>
      <div className="ins-row"><span>age</span><b>{o.age.toFixed(1)}s</b></div>
      <div className="ins-row"><span>children</span><b>{o.children}</b></div>
      <div className="ins-row"><span>lineage</span><b>#{o.lineage}</b></div>
      <div className="ins-row"><span>brain skill</span><b>{(o.brain.skill * 100).toFixed(0)}%</b></div>
      <div className="genome">
        {o.genome.map((v, i) => (
          <div className="gene" key={i}>
            <span className="gene-name">{GENE_NAMES[i]}</span>
            <div className="gene-bar"><div className="gene-fill" style={{ width: (v * 100).toFixed(1) + "%" }} /></div>
            <span className="gene-val">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
