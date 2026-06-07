import { COLORS, lerp, smoothstep } from "../utils/animationMath.js";
import TextPlane from "./TextPlane.jsx";

const CUE_LINES = ["Upload A Play", "Choose Your Role", "Practice Your Lines"];

// Bullet pops first, then a quick ink guideline writes itself out to the
// right of the bullet, then the text settles in above it.  Once the text
// is in place the guideline fades out - like ink drying on a notebook
// line.  Pure opacity + Y on the text means it never stretches.
function CueSentence({ cue, index, parentOpacity, progress }) {
  const start = 0.55 + index * 0.06;
  const end = start + 0.16;
  const entry = smoothstep(start, end, progress);
  const bulletIn = smoothstep(start - 0.02, start + 0.04, progress);
  const strokeDraw = smoothstep(start + 0.01, start + 0.07, progress);
  const strokeFade = 1 - smoothstep(end - 0.02, end + 0.05, progress);

  const planeW = 7.1;
  const textX = -2.1 + planeW * 0.5 - planeW * 0.04;
  const baseY = -1.02 - index * 0.62;
  const rise = (1 - entry) * 0.18;

  const strokeMaxW = 4.8;
  const strokeW = strokeDraw * strokeMaxW;
  const strokeCenterX = -2.32 + strokeW * 0.5;

  return (
    <group position={[0, baseY - rise, 0.02]}>
      <mesh position={[-2.42, 0.04, 0.04]} renderOrder={6}>
        <circleGeometry args={[0.08 * bulletIn, 28]} />
        <meshBasicMaterial
          color={COLORS.ink}
          transparent
          opacity={bulletIn * parentOpacity * 0.92}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {strokeW > 0.02 && strokeFade > 0.02 && (
        <mesh position={[strokeCenterX, -0.34, 0.04]} renderOrder={6}>
          <boxGeometry args={[strokeW, 0.018, 0.003]} />
          <meshBasicMaterial
            color={COLORS.ink}
            transparent
            opacity={parentOpacity * strokeFade * 0.55}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}

      <TextPlane
        position={[textX, 0, 0]}
        width={planeW}
        height={0.78}
        align="left"
        fontFamily="Manrope, Inter, sans-serif"
        fontWeight={600}
        fontPx={96}
        color={COLORS.ink}
        opacity={entry * parentOpacity * 0.96}
        textShadow={false}
        depthTest={false}
        renderOrder={5}
      >
        {cue}
      </TextPlane>
    </group>
  );
}

// Confident pen stroke under "A Line Learning Tool" - overlapping segments
// with a low-amplitude sine ride so it reads as one continuous line.
function PhraseUnderline({ phraseOp, progress }) {
  const draw = smoothstep(0.6, 0.72, progress);
  const segments = 72;
  const span = 6.7;

  return (
    <group>
      {Array.from({ length: segments }, (_, i) => {
        const t = i / (segments - 1);
        const seg = smoothstep(t * 0.92, t * 0.92 + 0.12, draw);
        if (seg < 0.02) return null;
        const x = lerp(-span / 2, span / 2, t);
        const y = -0.6 + Math.sin(t * Math.PI * 1.8) * 0.014;
        return (
          <mesh key={i} position={[x, y, 0.04]} renderOrder={5}>
            <boxGeometry args={[span / segments + 0.028, 0.028, 0.005]} />
            <meshBasicMaterial
              color={COLORS.ink}
              transparent
              opacity={seg * phraseOp * 0.82}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function FlyingLetters({ progress }) {
  const appear = smoothstep(0.44, 0.58, progress);
  const hold = smoothstep(0.55, 0.7, progress);
  const flyOff = smoothstep(0.7, 0.82, progress);
  const opacity = appear * (1 - flyOff);

  if (opacity < 0.01) return <group visible={false} />;

  const x = lerp(-0.34, -0.18, hold);
  const y = lerp(1.1, 1.3, hold) + flyOff * 5.2;
  const z = lerp(1.55, 1.12, hold) - flyOff * 5.8;
  const scale =
    lerp(lerp(0.22, 0.32, appear), 0.35, hold) * lerp(1, 0.38, flyOff);

  return (
    <group position={[x, y, z]} scale={scale}>
      <TextPlane
        width={7.25}
        height={0.92}
        fontFamily="Teko, Inter Tight, sans-serif"
        fontWeight={600}
        fontPx={372}
        letterSpacing={0.8}
        color={COLORS.ink}
        opacity={opacity}
        textShadow={false}
        depthTest={false}
        renderOrder={4}
      >
        A Line Learning Tool
      </TextPlane>

      <PhraseUnderline phraseOp={opacity} progress={progress} />

      <group position={[0, -0.08, 0.04]}>
        {CUE_LINES.map((cue, i) => (
          <CueSentence
            key={cue}
            cue={cue}
            index={i}
            progress={progress}
            parentOpacity={opacity}
          />
        ))}
      </group>
    </group>
  );
}
