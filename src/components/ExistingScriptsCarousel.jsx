import { COLORS, lerp, smoothstep } from "../utils/animationMath.js";
import TextPlane from "./TextPlane.jsx";

const SCRIPTS = [
  { title: "Machinal", x: -3.75, rot: -0.24, color: COLORS.gray },
  { title: "Hamlet", x: 3.75, rot: 0.22, color: COLORS.maroon },
];

export default function ExistingScriptsCarousel({ progress }) {
  const show = smoothstep(0.9, 0.99, progress);
  const y = lerp(-6.35, -5.58, show);
  const opacity = show;

  return (
    <group position={[0, y, -8.35]} visible={opacity > 0.01}>
      {SCRIPTS.map((script, index) => (
        <group
          key={script.title}
          position={[script.x + lerp(index ? 0.62 : -0.62, 0, show), 0, 0]}
          rotation={[0, 0, script.rot + lerp(index ? 0.16 : -0.16, 0, show)]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.85, 3.82, 0.08]} />
            <meshBasicMaterial
              color={script.color}
              transparent
              opacity={opacity * 0.9}
            />
          </mesh>
          <TextPlane
            position={[0, 0.42, 0.05]}
            width={0.84}
            height={0.28}
            fontPx={86}
            color={
              script.color === COLORS.maroon ? COLORS.offWhite : COLORS.offBlack
            }
            opacity={opacity}
          >
            {script.title}
          </TextPlane>
        </group>
      ))}
    </group>
  );
}
