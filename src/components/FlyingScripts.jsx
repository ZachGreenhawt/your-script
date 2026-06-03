import { COLORS, lerp, smoothstep, phaseProgress } from "../utils/animationMath.js";
import TextPlane from "./TextPlane.jsx";

const SCRIPTS = [
  {
    title: "Some Play",
    color: COLORS.maroon,
    size: [3.75, 5.08],
    start: [-0.7, -5.7, 2.8],
    mid: [-1.35, -0.32, 2.22],
    end: [-2.1, 22.4, -24.2],
    rotStart: [1.05, -0.08, -0.02],
    rotMid: [0.035, 0.02, -0.1],
    timing: [0.735, 0.81, 0.885],
  },
  {
    title: "Scene Two",
    color: COLORS.gray,
    size: [3.34, 4.56],
    start: [5.9, -0.9, 1.9],
    mid: [2.65, 0.92, 2.08],
    end: [3.1, 22.0, -24.0],
    rotStart: [0.15, 1.08, 0.2],
    rotMid: [0.02, -0.24, 0.045],
    timing: [0.765, 0.84, 0.91],
  },
  {
    title: "Act One",
    color: COLORS.offBlack,
    size: [3.5, 4.78],
    start: [-5.6, -3.9, 2.35],
    mid: [-3.18, 1.18, 2.12],
    end: [-3.6, 22.2, -23.8],
    rotStart: [0.92, -1.0, -0.25],
    rotMid: [0.055, 0.3, -0.085],
    timing: [0.795, 0.865, 0.935],
  },
  {
    title: "Role Cues",
    color: COLORS.maroon,
    size: [3.16, 4.34],
    start: [5.1, 3.45, 2.55],
    mid: [0.76, 2.18, 2.2],
    end: [1.15, 22.8, -24.1],
    rotStart: [-0.7, 0.76, 0.18],
    rotMid: [0.02, -0.16, -0.095],
    timing: [0.825, 0.895, 0.955],
  },
];

function lerpArray(from, to, t) {
  return from.map((value, index) => lerp(value, to[index], t));
}

// Clean, evenly-spaced body rule — a single thin line of ink on the page.
function BodyRule({ width, y, z, color, opacity }) {
  return (
    <mesh position={[0, y, z]}>
      <boxGeometry args={[width, 0.008, 0.003]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function ScriptObject({ script, progress }) {
  const arrive = smoothstep(0, 1, phaseProgress(progress, script.timing[0], script.timing[1]));
  const clear = smoothstep(0, 1, phaseProgress(progress, script.timing[1], script.timing[2]));
  const position = lerpArray(
    lerpArray(script.start, script.mid, arrive),
    script.end,
    clear,
  );
  const rotation = lerpArray(
    lerpArray(script.rotStart, script.rotMid, arrive),
    [script.rotMid[0] - 0.2, script.rotMid[1] + 0.06, script.rotMid[2] + 0.18],
    clear,
  );
  const opacity = smoothstep(script.timing[0], script.timing[0] + 0.018, progress);
  const cleared = progress >= script.timing[2] + 0.002;
  const w = script.size[0];
  const h = script.size[1];
  const ink = script.color === COLORS.gray ? COLORS.ink : COLORS.offWhite;
  const scribbleDraw = smoothstep(script.timing[0] + 0.024, script.timing[1], progress);

  return (
    <group
      position={position}
      rotation={rotation}
      visible={opacity > 0.01 && !cleared}
      renderOrder={8}
    >
      {/* Ink-edge behind the page */}
      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[w + 0.05, h + 0.05, 0.002]} />
        <meshBasicMaterial
          color={COLORS.ink}
          transparent
          opacity={opacity * 0.24}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      <mesh>
        <boxGeometry args={[w, h, 0.055]} />
        <meshBasicMaterial
          color={script.color}
          transparent
          opacity={opacity}
          depthTest={false}
        />
      </mesh>

      {/* Hand-drawn rule above the title */}
      <mesh position={[0, h * 0.34, 0.032]}>
        <boxGeometry args={[w * 0.78, 0.01, 0.003]} />
        <meshBasicMaterial
          color={ink}
          transparent
          opacity={opacity * 0.36}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      <TextPlane
        position={[0, h * 0.26, 0.034]}
        width={w * 0.78}
        height={0.42}
        fontFamily="Teko, Inter Tight, sans-serif"
        fontWeight={600}
        fontPx={120}
        letterSpacing={1.2}
        color={ink}
        opacity={opacity * 0.95}
        depthTest={false}
        renderOrder={9}
      >
        {script.title}
      </TextPlane>

      <mesh position={[0, -h * 0.34, 0.032]}>
        <boxGeometry args={[w * 0.54, 0.01, 0.003]} />
        <meshBasicMaterial
          color={ink}
          transparent
          opacity={opacity * 0.26}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {[-0.04, -0.12, -0.2, -0.28].map((frac, index) => (
        <BodyRule
          key={frac}
          width={w * (0.6 - index * 0.04)}
          y={h * frac}
          z={0.036}
          color={ink}
          opacity={opacity * scribbleDraw * 0.22}
        />
      ))}
    </group>
  );
}

export default function FlyingScripts({ progress }) {
  return (
    <group>
      {SCRIPTS.map((script) => (
        <ScriptObject key={script.title} script={script} progress={progress} />
      ))}
    </group>
  );
}
