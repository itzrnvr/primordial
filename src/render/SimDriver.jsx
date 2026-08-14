import { useFrame } from "@react-three/fiber";
import { world } from "../sim/world.js";
import { useStore } from "../state/store.js";

// Steps the simulation from the render loop. Substeps keep the
// physics stable when the user cranks up sim speed.
export default function SimDriver() {
  useFrame((_, delta) => {
    const { paused, speed } = useStore.getState();
    if (paused) return;
    const dt = Math.min(delta, 0.05) * speed;
    const n = Math.max(1, Math.ceil(dt / 0.033));
    for (let i = 0; i < n; i++) world.step(dt / n);
  });
  return null;
}
