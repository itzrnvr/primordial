import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { evolveWorld } from "../sim/evolve-runtime.js";

// The population, rendered as a ring of spheres around the vent.
//   height   = how much smarter than random guessing it currently is
//   size     = log10 of its parameter count
//   color    = its lineage (who it descends from)
//   glow     = finished its life and got scored
const RING = 17;
const SLOTS = 8;

function lineageHue(id) { return (((id || 1) * 137.508) % 360) / 360; }

export default function Population() {
  const group = useRef();
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const w = evolveWorld;
    for (let i = 0; i < SLOTS; i++) {
      const m = g.children[i];
      if (!m) continue;
      if (!w || i >= w.population.length) { m.scale.setScalar(0.0001); continue; }
      const ind = w.population[i];
      const ang = (i / w.population.length) * Math.PI * 2 + 0.5;
      const smart = ind.done && ind.valLoss != null
        ? (w.lnV - ind.valLoss) / w.lnV
        : (w.lnV - ind.trainEMA) / w.lnV;
      const targetY = 1.5 + Math.max(0, smart) * 16;
      m.position.x += (Math.cos(ang) * RING - m.position.x) * 0.08;
      m.position.z += (Math.sin(ang) * RING - m.position.z) * 0.08;
      m.position.y += (targetY - m.position.y) * 0.08;
      const s = 0.55 + 0.5 * Math.log10(Math.max(10, ind.org.paramCount()));
      m.scale.setScalar(s * (1 + Math.sin(t * 2 + i * 1.7) * 0.045));
      const hue = lineageHue(ind.lineage);
      m.material.color.setHSL(hue, 0.72, ind.done ? 0.6 : 0.42);
      m.material.emissive.setHSL(hue, 0.9, ind.done ? 0.45 : 0.1);
    }
  });
  return (
    <group ref={group}>
      {Array.from({ length: SLOTS }).map((_, i) => (
        <mesh key={i} position={[0, -40, 0]} scale={0.0001}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial roughness={0.35} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}
