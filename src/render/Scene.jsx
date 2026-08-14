import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import SimDriver from "./SimDriver.jsx";
import Vent from "./Vent.jsx";
import Organisms from "./Organisms.jsx";
import GrowingCell from "./GrowingCell.jsx";
import Population from "./Population.jsx";
import { useStore } from "../state/store.js";

export default function Scene({ onSelect }) {
  const mode = useStore((s) => s.mode);
  return (
    <Canvas
      camera={{ position: [0, 34, 78], fov: 50, near: 0.1, far: 500 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#030409"]} />
      <fog attach="fog" args={["#030409", 90, 230]} />
      <ambientLight intensity={0.32} />
      <SimDriver />
      <Vent />
      {mode === "ecosystem" ? (
        <Organisms onSelect={onSelect} />
      ) : mode === "organism" ? (
        <GrowingCell />
      ) : (
        <Population />
      )}
      <Stars radius={230} depth={60} count={2600} factor={5} saturation={0.35} fade speed={0.5} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.35}
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={230}
      />
      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.24} luminanceSmoothing={0.85} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.82} />
      </EffectComposer>
    </Canvas>
  );
}
