import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import Book from "./Book.jsx";
import ExistingScriptsCarousel from "./ExistingScriptsCarousel.jsx";
import {
  COLORS,
  lerp,
  smoothstep,
  easeInOutQuart,
} from "../utils/animationMath.js";

// ─── Final "New Script" book ───────────────────────────────────────────────
// Flies up into the final composition (scroll-driven), then becomes
// clickable. On click it opens in place with a small forward drift, then
// dispatches a `newScriptClick` event so LandingPage can hand off to /upload.

function NewScriptBook({ progress }) {
  const groupRef = useRef(null);
  const clickStartRef = useRef(null);
  const [clickAnim, setClickAnim] = useState(0); // 0 → 1
  const [hovered, setHovered] = useState(false);
  const armed = progress > 0.965;

  // Scroll-driven entrance.
  const fly = smoothstep(0.89, 0.992, progress);
  const baseOpen = lerp(0.72, 0, fly);
  const baseY = lerp(-5.65, -0.08, fly);
  const baseZ = lerp(-4.1, -7.18, fly);
  const baseScale = lerp(1.16, 2.78, fly);
  const baseRotX = lerp(0.92, -0.08, fly);
  const baseRotY = lerp(-0.25, 0, fly);

  // Listen for the click event dispatched from either the 3D book itself or
  // the HTML hit-box that sits over its silhouette.
  useEffect(() => {
    const handler = () => {
      if (!armed || clickStartRef.current !== null) return;
      clickStartRef.current = performance.now();
    };
    window.addEventListener("newScriptClick", handler);
    return () => window.removeEventListener("newScriptClick", handler);
  }, [armed]);

  useEffect(() => {
    const handler = (event) => setHovered(Boolean(event.detail));
    window.addEventListener("newScriptHover", handler);
    return () => window.removeEventListener("newScriptHover", handler);
  }, []);

  // Drive the click animation in useFrame so it's independent of scroll.
  useFrame(() => {
    if (clickStartRef.current === null) return;
    const elapsed = performance.now() - clickStartRef.current;
    const t = Math.min(1, elapsed / 1800);
    const v = easeInOutQuart(t);
    setClickAnim((prev) => (Math.abs(prev - v) > 0.002 ? v : prev));
    if (t >= 1) clickStartRef.current = null;
  });

  // Compose scroll + click animations:
  // - Book stays closed at rest, then opens slowly.
  // - It eases forward just enough to feel selected.
  // - Scale stays restrained so it does not look like an accidental balloon.
  const y = lerp(baseY, 0.04, clickAnim);
  const z = lerp(baseZ, -5.95, clickAnim);
  const scale = baseScale * lerp(1, 1.035, clickAnim);
  const rotX = lerp(baseRotX, -0.04, clickAnim);
  const rotY = lerp(baseRotY, 0, clickAnim);
  const openAmount = baseOpen + clickAnim * 0.82;

  const handleClick = (event) => {
    event.stopPropagation();
    if (!armed) return;
    window.__newScriptClicked = true;
    console.log("New Script clicked");
    window.dispatchEvent(new CustomEvent("newScriptClick"));
  };

  return (
    <group
      ref={groupRef}
      position={[0, y, z]}
      rotation={[rotX, rotY, 0]}
      visible={progress > 0.885}
    >
      <Book
        title="New Script"
        openAmount={openAmount}
        coverColor={COLORS.maroon}
        pageColor={COLORS.offWhite}
        textColor={COLORS.offWhite}
        titleFontPx={240}
        coverSubtitle="TAP TO BEGIN"
        coverSubtitleFontPx={68}
        coverSubtitleSpacing={5.2}
        hoverCoverColor={"#594a39"}
        hoverTextColor={COLORS.ink}
        hoveredOverride={hovered}
        pageTextLines={[
          { text: "Upload a script.", opacityCurve: [0.2, 0.42] },
          { text: "Choose your role.", opacityCurve: [0.34, 0.56] },
          { text: "Start rehearsal.", opacityCurve: [0.48, 0.72] },
        ]}
        width={1.5}
        height={2.1}
        depth={0.14}
        scale={scale}
        clickable={armed && clickStartRef.current === null}
        onClick={handleClick}
      />
    </group>
  );
}

export default function UploadCTA({ progress }) {
  return (
    <group>
      <ExistingScriptsCarousel progress={progress} />
      <NewScriptBook progress={progress} />
    </group>
  );
}
