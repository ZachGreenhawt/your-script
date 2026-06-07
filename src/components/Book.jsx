import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { COLORS, lerp, smoothstep } from "../utils/animationMath.js";
import TextPlane from "./TextPlane.jsx";

// Notebook line y-positions as fractions of page height.
// Six clean evenly-spaced rules - no wobble, all the same width - so the
// page reads as a proper printed notebook rather than a noisy sketch.
const NOTEBOOK_FRACS = [0.32, 0.18, 0.04, -0.1, -0.24, -0.38];
// Indices 0, 2, 4  → fracs  0.32, 0.04, -0.24  - used for the three text lines.
const TEXT_LINE_INDICES = [0, 2, 4];

// Clean ruled-paper rendering.  Uniform line width and length; left margin
// rule in warm clay.
function PageLines({ width, height, depth, openAmount }) {
  const opacity = lerp(0, 0.5, openAmount);
  const pageZ = depth * 0.56;
  const lineW = width * 0.84;

  return (
    <group position={[0, 0, pageZ]}>
      {/* Left margin rule */}
      <mesh position={[-width * 0.3, 0, 0.002]}>
        <boxGeometry args={[0.005, height * 0.86, 0.003]} />
        <meshBasicMaterial
          color="#c09880"
          transparent
          opacity={opacity * 0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Horizontal ruled lines - clean, uniform */}
      {NOTEBOOK_FRACS.map((frac, i) => (
        <mesh key={i} position={[0.02, frac * height, 0.003]}>
          <boxGeometry args={[lineW, 0.004, 0.003]} />
          <meshBasicMaterial
            color={COLORS.pencil}
            transparent
            opacity={opacity * 0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// Thin "binding edge" rim drawn just inside the spine - gives the book a
// sketched outline feel without resorting to wireframes.
function SpineRules({ height, depth, opacity }) {
  return (
    <group position={[-0.53, 0, 0]}>
      <mesh position={[0, 0, depth * 0.32]}>
        <boxGeometry args={[0.005, height + 0.05, 0.003]} />
        <meshBasicMaterial
          color={COLORS.pencil}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, -depth * 0.32]}>
        <boxGeometry args={[0.005, height + 0.05, 0.003]} />
        <meshBasicMaterial
          color={COLORS.pencil}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Single clean fore-edge line on the right side of the page block -
// suggests the stack of pages without the noisy random tick marks.
function PageEdge({ width, height, depth, opacity }) {
  return (
    <mesh position={[width * 0.51, 0, depth * 0.18]}>
      <boxGeometry args={[0.004, height * 0.92, 0.003]} />
      <meshBasicMaterial
        color={COLORS.pencil}
        transparent
        opacity={opacity * 0.28}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Book({
  title,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  openAmount = 0,
  coverColor = COLORS.offBlack,
  pageColor = COLORS.offWhite,
  textColor = COLORS.offWhite,
  width = 1.25,
  height = 1.75,
  depth = 0.14,
  clickable = false,
  onClick,
  pageTextLines = null,
  titleOpacity = 0.96,
  titleFontPx = null,
  coverSubtitle = "REHEARSAL · VOL I",
  coverSubtitleFontPx = 42,
  coverSubtitleSpacing = 3.6,
  hoverCoverColor = "#c59a7c",
  hoverTextColor = null,
  hoveredOverride = false,
}) {
  const [hovered, setHovered] = useState(false);
  const bookRef = useRef(null);
  const hoverMotion = useRef({ lift: 0, scale: 1, tilt: 0 });
  const isHovered = (hovered || hoveredOverride) && clickable;
  const targetLift = isHovered ? 0.12 : 0;
  const targetScale = isHovered ? 1.05 : 1;
  const targetTilt = isHovered ? -0.025 : 0;
  const coverRotation = -openAmount * 2.32;

  useFrame((_, delta) => {
    if (!bookRef.current) return;

    const ease = 1 - Math.exp(-delta * 7.5);
    hoverMotion.current.lift = lerp(hoverMotion.current.lift, targetLift, ease);
    hoverMotion.current.scale = lerp(hoverMotion.current.scale, targetScale, ease);
    hoverMotion.current.tilt = lerp(hoverMotion.current.tilt, targetTilt, ease);

    bookRef.current.position.set(
      position[0],
      position[1] + hoverMotion.current.lift,
      position[2],
    );
    bookRef.current.rotation.set(
      rotation[0],
      rotation[1],
      rotation[2] + hoverMotion.current.tilt,
    );
    bookRef.current.scale.setScalar(scale * hoverMotion.current.scale);
  });

  const displayCoverColor = isHovered ? hoverCoverColor : coverColor;
  const isLightCover =
    displayCoverColor === COLORS.gray ||
    displayCoverColor === COLORS.offWhite ||
    displayCoverColor === hoverCoverColor;
  const displayTextColor = textColor;

  // A restrained ink rim keeps the object readable without noisy surface marks.
  const inkEdge = (w, h, z) => (
    <mesh position={[0, 0, z]}>
      <boxGeometry args={[w + 0.018, h + 0.018, 0.001]} />
      <meshBasicMaterial
        color={COLORS.ink}
        transparent
        opacity={0.32}
        depthWrite={false}
      />
    </mesh>
  );

  return (
    <group
      ref={bookRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={clickable ? onClick : undefined}
      onPointerOver={
        clickable ?
          (event) => {
            event.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }
        : undefined
      }
      onPointerOut={
        clickable ?
          () => {
            setHovered(false);
            document.body.style.cursor = "";
          }
        : undefined
      }
    >
      {/* page block */}
      <mesh castShadow position={[0.03, 0, -depth * 0.18]}>
        <boxGeometry args={[width, height, depth * 0.68]} />
        <meshBasicMaterial color={pageColor} />
      </mesh>
      <PageEdge width={width} height={height} depth={depth} opacity={0.8} />

      {/* back cover */}
      <mesh castShadow position={[0, 0, -depth * 0.52]}>
        <boxGeometry args={[width + 0.08, height + 0.08, depth * 0.35]} />
        <meshBasicMaterial color={displayCoverColor} />
      </mesh>

      {/* spine */}
      <mesh castShadow position={[-width * 0.53, 0, 0]}>
        <boxGeometry args={[0.08, height + 0.12, depth * 1.25]} />
        <meshBasicMaterial color={displayCoverColor} />
      </mesh>

      <SpineRules
        height={height}
        depth={depth}
        opacity={isLightCover ? 0.12 : 0.25}
      />

      {/* front cover (opens) */}
      <group
        position={[-width / 2, 0, depth * 0.12]}
        rotation={[0, coverRotation, 0]}
      >
        {/* Sketched ink rim sitting behind the cover face. */}
        <group position={[width / 2, 0, 0]}>
          {inkEdge(width + 0.07, height + 0.08, -0.001)}
        </group>

        <mesh castShadow position={[width / 2, 0, 0]}>
          <boxGeometry args={[width + 0.07, height + 0.08, depth * 0.3]} />
          <meshBasicMaterial color={displayCoverColor} />
        </mesh>

        {/* Hand-drawn rule above the title */}
        <mesh position={[width / 2 + 0.06, height * 0.22, depth * 0.21]}>
          <boxGeometry args={[width * 0.6, 0.008, 0.003]} />
          <meshBasicMaterial
            color={displayTextColor}
            transparent
            opacity={titleOpacity * 0.45}
            depthWrite={false}
          />
        </mesh>

        <TextPlane
          position={[width / 2, 0.0, depth * 0.215]}
          width={width * 0.84}
          height={height * 0.4}
          fontFamily="Teko, Inter Tight, sans-serif"
          fontWeight={600}
          fontPx={titleFontPx ?? (title.length > 11 ? 170 : 220)}
          lineHeight={0.88}
          letterSpacing={0.35}
          color={displayTextColor}
          opacity={titleOpacity}
          textShadow={false}
        >
          {title}
        </TextPlane>

        {/* Hand-drawn rule below the title */}
        <mesh position={[width / 2 + 0.06, -height * 0.22, depth * 0.21]}>
          <boxGeometry args={[width * 0.6, 0.008, 0.003]} />
          <meshBasicMaterial
            color={displayTextColor}
            transparent
            opacity={titleOpacity * 0.45}
            depthWrite={false}
          />
        </mesh>

        {coverSubtitle ?
          <TextPlane
            position={[width / 2, -height * 0.34, depth * 0.215]}
            width={width * 0.86}
            height={0.18}
            fontFamily="Inter Tight, Manrope, sans-serif"
            fontWeight={500}
            fontPx={coverSubtitleFontPx}
            letterSpacing={coverSubtitleSpacing}
            color={displayTextColor}
            opacity={titleOpacity * 0.68}
            textShadow={false}
          >
            {coverSubtitle}
          </TextPlane>
        : null}
      </group>

      <PageLines
        width={width}
        height={height}
        depth={depth}
        openAmount={openAmount}
      />

      {pageTextLines ?
        pageTextLines.map((line, index) => {
          const lineOpacity = smoothstep(
            line.opacityCurve[0],
            line.opacityCurve[1],
            openAmount,
          );
          // Position text so it sits just above the corresponding notebook
          // line - visually the text "writes on" the ruled line below it.
          const lineFrac = NOTEBOOK_FRACS[TEXT_LINE_INDICES[index]];
          const lineY = lineFrac * height;
          // TextPlane height: single line of text - sized to sit neatly
          // between two ruled lines.
          const planeH = height * 0.11;
          // Center the plane so its bottom baseline lands on the ruled
          // line: center = lineY + planeH/2 + tiny gap above the line.
          const yOffset = lineY + planeH * 0.5 + 0.01;
          // Horizontal: plane center is set so left edge lands just right
          // of the margin line (margin at -width*0.28). align="left" so
          // the text writes left-to-right from that edge, like ink on paper.
          const planeW = width * 0.7;
          const xCenter = -width * 0.28 + planeW * 0.5 + width * 0.02;
          return (
            <group key={line.text}>
              <TextPlane
                position={[xCenter, yOffset, depth * 0.64]}
                width={planeW}
                height={planeH}
                fontFamily="Inter Tight, Manrope, Arial, sans-serif"
                fontWeight={500}
                fontStyle="italic"
                fontPx={160}
                align="left"
                lineHeight={1}
                letterSpacing={0}
                color={COLORS.ink}
                opacity={lineOpacity}
                textShadow={false}
              >
                {line.text}
              </TextPlane>
            </group>
          );
        })
      : null}
    </group>
  );
}
