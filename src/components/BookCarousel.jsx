import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import Book from "./Book.jsx";
import { COLORS, lerp, smoothstep } from "../utils/animationMath.js";

// ─── The library row ─────────────────────────────────────────────────────
// Seven plays in a single upright row.  Your Script is the centre book — no
// special standalone treatment, no orbital rotation, no flying paths that
// could intersect.  The camera does all the motion.
//
// Books stand on a quiet shelf at y=-0.45 so the camera (held at eye
// level the whole time) reads them by their covers.  Each book has a
// tiny independent Y-bob so the row breathes without ever feeling like
// it's moving.

const BOOKS = [
  { title: "Hamlet",       color: COLORS.gray,     x: -3.72, rotZ:  0.035 },
  { title: "Machinal",     color: COLORS.offBlack, x: -2.46, rotZ: -0.028 },
  { title: "Cue Book",     color: COLORS.maroon,   x: -1.22, rotZ:  0.018 },
  { title: "Your Script",   color: COLORS.offBlack, x:  0.00, rotZ:  0.00, isHero: true, subtitle: "LINE REHEARSAL" },
  { title: "Smokefall",    color: COLORS.gray,     x:  1.22, rotZ: -0.018 },
  { title: "The Crucible", color: COLORS.maroon,   x:  2.46, rotZ:  0.028 },
  { title: "Scene Work",   color: COLORS.offBlack, x:  3.72, rotZ: -0.035 },
];

// Reveal stagger — Your Script shows first, then siblings ripple outward
// from the centre.  Index-distance-based.
const REVEAL_STAGGER = [0.18, 0.14, 0.08, 0.0, 0.08, 0.14, 0.18];

function ShelfBook({ book, index, titleOpacity, enter, exit }) {
  const groupRef = useRef(null);

  // Tiny independent breathing — different phase per index so the row
  // never moves as one block.  Amplitude well below "floating".
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = Math.sin(t * 0.6 + index * 0.7) * 0.012;
  });

  // Entrance — books rise into place from slightly below with a soft
  // opacity ramp.  No lateral slide so no two books ever cross paths.
  const slide = 1 - enter;
  const enterDrop = slide * -0.4;

  // Exit — every book sinks straight down and fades.  Uniform motion
  // means no intersections, no scale mismatches, no overlap weirdness.
  const exitDrop = -exit * 1.8;
  const exitFade = 1 - exit;

  return (
    <group
      ref={groupRef}
      position={[book.x, enterDrop + exitDrop, 0]}
      rotation={[0, 0, book.rotZ]}
      scale={enter * exitFade}
    >
      <Book
        title={book.title}
        coverColor={book.color}
        pageColor={COLORS.offWhite}
        textColor={book.color === COLORS.gray ? COLORS.ink : COLORS.offWhite}
        coverSubtitle={book.subtitle ?? "REHEARSAL · VOL I"}
        width={book.isHero ? 1.04 : 0.86}
        height={book.isHero ? 1.58 : 1.38}
        depth={book.isHero ? 0.135 : 0.12}
        titleOpacity={titleOpacity}
        titleFontPx={book.isHero ? 175 : null}
        openAmount={0}
      />
    </group>
  );
}

export default function BookCarousel({ progress }) {
  // Overall group sits low so the upright books read at eye level from
  // the camera, with a touch of forward push as the user scrolls in.
  const groupZ = lerp(0.4, -0.4, smoothstep(0.0, 0.42, progress));
  const groupYaw = lerp(0, -0.06, smoothstep(0.35, 0.55, progress));
  // Slight scale-up on reveal so the row feels like it's being walked up to,
  // never a "pop in".
  const groupScale = lerp(0.92, 1.0, smoothstep(0.02, 0.22, progress));

  // Titles only become readable once the row is settled.
  const titleReveal = smoothstep(0.06, 0.22, progress) * 0.95;

  // Per-book enter window — hero first, then outward.
  // All books exit together (sink + fade) during the phrase approach.
  const exit = smoothstep(0.48, 0.62, progress);

  return (
    <group position={[0, -0.45, groupZ]} rotation={[0, groupYaw, 0]} scale={groupScale}>
      {BOOKS.map((book, index) => {
        const enterStart = 0.04 + REVEAL_STAGGER[index];
        const enterEnd   = 0.16 + REVEAL_STAGGER[index];
        const enter = smoothstep(enterStart, enterEnd, progress);
        if (enter < 0.001) return null;
        if (1 - exit < 0.001) return null;
        return (
          <ShelfBook
            key={book.title}
            book={book}
            index={index}
            titleOpacity={titleReveal}
            enter={enter}
            exit={exit}
          />
        );
      })}
    </group>
  );
}
