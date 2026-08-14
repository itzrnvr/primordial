import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import SimDriver from "./SimDriver.jsx";
import Vent from "./Vent.jsx";
import Organisms from "./Organisms.jsx";

export default function Scene({ onSelect }) {
  return (
    <Canvas
      camera={{ position: [0, 26, 56], fov: 50, near: 0.1, far: 400 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#030409"]} />
      <fog attach="fog" args={["#030409", 75, 170]} />
      <ambientLight intensity={0.32} />
      <SimDriver />
      <Vent />
      <Organisms onSelect={onSelect} />
      <Stars radius={230} depth={60} count={2600} factor={5} saturation={0.35} fade speed={0.5} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={150}
      />
      <EffectComposer>
        <Bloom intensity={1.05} luminanceThreshold={0.18} luminanceSmoothing={0.85} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.82} />
      </EffectComposer>
    </Canvas>
  );
}
