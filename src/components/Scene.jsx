import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { Vector3, PCFSoftShadowMap } from "three";
import BookCarousel from "./BookCarousel.jsx";
import FlyingLetters from "./FlyingLetters.jsx";
import FlyingScripts from "./FlyingScripts.jsx";
import UploadCTA from "./UploadCTA.jsx";
import {
  smoothstep,
  lerp,
  clamp,
} from "../utils/animationMath.js";

// Continuous camera path.  Eye-level throughout (y ≈ 0.4 → 0.85) so the
// upright row of books reads by its covers, not its tops.  Three beats:
//   – approach & dolly back to reveal the full row (0 → 0.42)
//   – drift sideways then forward as books exit and the phrase appears
//     (0.42 → 0.7)
//   – pull through to the CTA scene (0.7 → 1.0)
const CAMERA_PATH = [
  { p: 0.0,  pos: [0,     0.4,  4.6],  tgt: [0,    0.0,  0],     fov: 38 },
  { p: 0.10, pos: [0,     0.45, 5.2],  tgt: [0,   -0.05, 0],     fov: 41 },
  { p: 0.20, pos: [0.05,  0.55, 5.8],  tgt: [0,   -0.1, -0.1],   fov: 44 },
  { p: 0.30, pos: [0.3,   0.6,  5.9],  tgt: [0,   -0.05,-0.25],  fov: 45 },
  { p: 0.42, pos: [-0.45, 0.7,  5.7],  tgt: [0,   -0.05,-0.5],   fov: 45 },
  { p: 0.50, pos: [-0.85, 0.7,  6.0],  tgt: [0,    0.05,-0.9],   fov: 44 },
  { p: 0.56, pos: [-1.05, 0.7,  6.5],  tgt: [0,    0.1, -1.4],   fov: 42 },
  { p: 0.62, pos: [-0.95, 0.7,  7.0],  tgt: [0,    0.15,-2.0],   fov: 40 },
  { p: 0.70, pos: [-0.45, 0.8,  7.8],  tgt: [0,    0.3, -4.0],   fov: 38 },
  { p: 0.76, pos: [-0.2,  0.85, 8.5],  tgt: [0,    0.45,-6.5],   fov: 37 },
  { p: 0.84, pos: [-0.08, 0.85, 9.1],  tgt: [0,    0.6, -9.0],   fov: 35 },
  { p: 0.92, pos: [0,     0.75, 9.75], tgt: [0,    0.8, -11.0],  fov: 34 },
  { p: 1.0,  pos: [0,     0.6,  9.4],  tgt: [0,    0.75,-10.5],  fov: 34 },
];

function sampleCameraPath(progress) {
  const p = clamp(progress);
  if (p <= CAMERA_PATH[0].p) return CAMERA_PATH[0];
  if (p >= CAMERA_PATH[CAMERA_PATH.length - 1].p) {
    return CAMERA_PATH[CAMERA_PATH.length - 1];
  }

  for (let i = 0; i < CAMERA_PATH.length - 1; i++) {
    const a = CAMERA_PATH[i];
    const b = CAMERA_PATH[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = smoothstep(a.p, b.p, p);
      return {
        pos: [
          lerp(a.pos[0], b.pos[0], t),
          lerp(a.pos[1], b.pos[1], t),
          lerp(a.pos[2], b.pos[2], t),
        ],
        tgt: [
          lerp(a.tgt[0], b.tgt[0], t),
          lerp(a.tgt[1], b.tgt[1], t),
          lerp(a.tgt[2], b.tgt[2], t),
        ],
        fov: lerp(a.fov, b.fov, t),
      };
    }
  }

  return CAMERA_PATH[CAMERA_PATH.length - 1];
}

function SceneContents({ progress }) {
  const cameraRef = useRef(null);
  const worldRef = useRef(null);
  const lookAt = useMemo(() => new Vector3(0, -0.02, 0), []);
  const targetPosition = useMemo(() => new Vector3(), []);
  const targetLookAt = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!cameraRef.current) return;

    const sample = sampleCameraPath(progress);
    targetPosition.set(sample.pos[0], sample.pos[1], sample.pos[2]);
    targetLookAt.set(sample.tgt[0], sample.tgt[1], sample.tgt[2]);

    cameraRef.current.position.lerp(targetPosition, 0.11);
    lookAt.lerp(targetLookAt, 0.11);
    cameraRef.current.lookAt(lookAt);
    cameraRef.current.fov = lerp(cameraRef.current.fov, sample.fov, 0.1);
    cameraRef.current.updateProjectionMatrix();

    if (worldRef.current) {
      // The carousel + hero book shrink off into the distance. FlyingLetters
      // is intentionally OUTSIDE this group so the phrase stays at full size.
      const shrink = smoothstep(0.7, 0.86, progress);
      const scale = lerp(1.06, 0.16, shrink);
      worldRef.current.scale.setScalar(scale);
      worldRef.current.position.y = lerp(0, 8.2, shrink);
      worldRef.current.position.z = lerp(0, -6.0, shrink);
      worldRef.current.rotation.z = lerp(0, -0.045, shrink);
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0.42, 5.4]}
        fov={41}
        near={0.1}
        far={80}
      />

      {/* Directional light exists purely for shadow-map generation.
          MeshBasicMaterial surfaces are unaffected by it - they stay flat
          and hand-drawn.  Only the ShadowMaterial floor plane below will
          show the soft projected shadow, giving modern depth without any
          plastic-looking lighting on the books themselves. */}
      <directionalLight
        castShadow
        position={[4, 12, 5]}
        intensity={1.0}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-radius={6}
        shadow-bias={-0.0008}
      />

      <UploadCTA progress={progress} />

      <group ref={worldRef} visible={progress < 0.94}>
        <BookCarousel progress={progress} />

        {/* Shadow-catching floor - transparent except where shadow falls.
            Scales and moves with worldRef so shadows remain consistent
            throughout the carousel phase.  Fades to invisible when the
            world shrinks away. */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.85, 0]}
        >
          <planeGeometry args={[28, 28]} />
          <shadowMaterial transparent opacity={0.13} depthWrite={false} />
        </mesh>
      </group>

      {/* FlyingLetters lives at its own world position so the phrase can stay
          large, bold, and fully readable during 0.5–0.78. */}
      <FlyingLetters progress={progress} />

      <FlyingScripts progress={progress} />
    </>
  );
}

export default function Scene({ progress }) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, 1.85]}
      className="landing-canvas"
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <SceneContents progress={progress} />
    </Canvas>
  );
}
