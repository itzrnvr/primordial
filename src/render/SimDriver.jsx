import { useFrame } from "@react-three/fiber";
import { world } from "../sim/world.js";
import { linguaWorld } from "../sim/lingua-runtime.js";
import { evolveWorld } from "../sim/evolve-runtime.js";
import { useStore } from "../state/store.js";

// Steps the active simulation from the render loop.
export default function SimDriver() {
  useFrame((_, delta) => {
    const { paused, speed, mode } = useStore.getState();
    if (paused) return;
    if (mode === "organism") {
      if (linguaWorld) linguaWorld.step(Math.min(delta, 0.05), speed);
      return;
    }
    if (mode === "evolve") {
      if (evolveWorld) evolveWorld.step(Math.min(delta, 0.05), speed);
      return;
    }
    const dt = Math.min(delta, 0.05) * speed;
    const n = Math.max(1, Math.ceil(dt / 0.033));
    for (let i = 0; i < n; i++) world.step(dt / n);
  });
  return null;
}
