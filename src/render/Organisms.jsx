import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "../sim/world.js";
import { HARD_CAP, GENE } from "../sim/constants.js";

const WHITE = new THREE.Color("#ffffff");
const RED = new THREE.Color("#ff5040");
const colorCache = new Map();
function lineageColor(id) {
  let c = colorCache.get(id);
  if (!c) {
    c = new THREE.Color().setHSL(((id * 137.508) % 360) / 360, 0.72, 0.58);
    colorCache.set(id, c);
  }
  return c;
}

// Renders every organism as one instance of a single sphere mesh.
// Matrices and colors are written imperatively each frame - React
// never reconciles per-organism nodes, so 700 cells stay cheap.
export default function Organisms({ onSelect }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const orgs = world.organisms;
    const n = Math.min(orgs.length, HARD_CAP);
    for (let i = 0; i < n; i++) {
      const o = orgs[i];
      const r = 0.34 + o.genome[GENE.SIZE] * 0.6 + Math.min(o.energy, 160) / 550;
      dummy.position.set(o.pos.x, o.pos.y, o.pos.z);
      dummy.scale.setScalar(r * (1 + o.flash * 0.85));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(lineageColor(o.lineage));
      const pk = o.genome[GENE.PREDATION];
      if (pk > 0.3) tmp.lerp(RED, Math.min(1, (pk - 0.3) * 1.1)); // hunters glow red
      const fed = Math.min(1, Math.max(0.18, o.energy / 110));
      tmp.multiplyScalar(0.4 + 0.6 * fed);                        // starving = dim, fed = bright
      if (o.flash > 0) tmp.lerp(WHITE, Math.min(1, o.flash) * 0.8); // birth flash
      mesh.setColorAt(i, tmp);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, HARD_CAP]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) {
          const o = world.organisms[e.instanceId];
          if (o) onSelect(o.id);
        }
      }}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial roughness={0.35} metalness={0.08} emissive="#334" emissiveIntensity={0.32} />
    </instancedMesh>
  );
}
