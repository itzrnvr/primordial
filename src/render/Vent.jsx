import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// The hydrothermal vent: the sun of this universe. All energy
// (nutrients) radiates from here, and its pulse is the heartbeat
// of the scene.
export default function Vent() {
  const mesh = useRef();
  const mat = useRef();
  const light = useRef();
  const halo = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = 1 + Math.sin(t * 2.1) * 0.1 + Math.sin(t * 5.3) * 0.05;
    if (mesh.current) mesh.current.scale.setScalar(p);
    if (halo.current) halo.current.scale.setScalar(p * 2.1);
    if (mat.current) mat.current.emissiveIntensity = 2.7 + Math.sin(t * 3.7) * 0.7;
    if (light.current) light.current.intensity = 240 * p;
  });

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshStandardMaterial
          ref={mat}
          color="#ffb45e"
          emissive="#ff7b2d"
          emissiveIntensity={2.7}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[2.6, 24, 24]} />
        <meshBasicMaterial color="#ff8a3d" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#ff9a4d" intensity={240} distance={130} decay={1.8} />
    </group>
  );
}
