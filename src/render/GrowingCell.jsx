import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { linguaWorld } from "../sim/lingua-runtime.js";

// One cell that physically grows as its network grows, drifts
// colour as it matures, and flashes on every growth spurt.
export default function GrowingCell() {
  const mesh = useRef();
  const mat = useRef();
  useFrame(({ clock }) => {
    const w = linguaWorld;
    if (!w || !mesh.current) return;
    const r = 0.9 + Math.log10(Math.max(10, w.org.paramCount())) * 0.62;
    w.flash = Math.max(0, w.flash - 0.02);
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.04 + w.flash * 0.45;
    mesh.current.scale.setScalar(r * pulse);
    const stage = Math.min(1, w.org.growths / 11);
    mat.current.color.setHSL(0.38 + stage * 0.32, 0.68, 0.55);
    mat.current.emissive.copy(mat.current.color);
    mat.current.emissiveIntensity = 0.9 + w.flash * 1.6;
  });
  return (
    <mesh ref={mesh} position={[0, 3.5, 9.5]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial ref={mat} color="#7cffb2" emissive="#2d8f5e" emissiveIntensity={0.9} roughness={0.3} metalness={0.1} />
    </mesh>
  );
}
