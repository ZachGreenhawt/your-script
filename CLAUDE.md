# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
```

No linter, formatter, or test suite is configured.

## Architecture

This is a single-page, scroll-driven 3D landing experience for the "Your Story" theatre line-learning app. There are no routes, no API calls, and no state beyond `progress` (a 0–1 scroll fraction).

### Scroll → progress pipeline

`LandingPage.jsx` creates a 1000 vh tall `<main>` (`.landing-scroll`) whose child `.landing-pin` is `position: sticky`. Lenis provides smooth scrolling; GSAP ScrollTrigger maps scroll position to a single `progress` value (0–1) via `useScrollTimeline`. That scalar is the only prop passed down to every 3D and overlay component.

### Two rendering layers (stacked via `position: absolute`)

| Layer | Component | Purpose |
|---|---|---|
| Three.js canvas | `Scene` / `SceneContents` | All 3D geometry and camera |
| HTML | `HtmlOverlay` | Site chrome (nav), snapshot mask panels, "New Script" hit-box, final corner-tick frame |
| Grain | `.grain-layer` div | CSS radial-gradient film grain overlay |

### Phase system (`src/utils/animationMath.js`)

`PHASES` maps named animation segments to `[start, end]` ranges within 0–1 global progress. Use `phase(name, progress)` to get a 0–1 local progress for any named phase. All timing changes should start here.

Current phases in order:
`introBook → openBook → closeAndPullBack → flatCarouselLowerCamera → lettersAndReorient → diagonalPhraseHold → pageFrameZoomOut → scriptsFlyIn → revealUpload → minimalFrameTexture → newScriptFlyUp`

Helper functions: `lerp`, `smoothstep`, `clamp`, `mapRange`, `phaseProgress`, `lerpVec3`.

### Camera choreography (`Scene.jsx` — `SceneContents.useFrame`)

Camera position, lookAt target, and FOV are driven entirely by `progress` breakpoints inside `useFrame`. The camera lerps toward computed targets each frame (factor 0.13) for organic lag. A `worldRef` group is scaled down and repositioned during `shrink` (progress 0.66–0.88) to create the pull-back-and-shrink illusion without moving the camera.

### 3D component map

- **`Book`** — reusable book mesh (cover, spine, pages, `TextPlane` title + optional interior copy). Supports `clickable` hover/click interaction.
- **`BookCarousel`** — 7 books arranged on a circular orbit; flat bird's-eye view that stands upright as `stand` progresses.
- **`FlyingLetters`** — "a line learning tool" phrase words that coalesce from scattered fragments.
- **`FlyingScripts`** — 4 script-shaped flat boxes that fly in from off-screen, land briefly, then exit upward to reveal the background CTA text.
- **`UploadCTA`** — background `TextPlane` group ("UPLOAD / A PLAY TO / GET STARTED"), `ExistingScriptsCarousel`, and `NewScriptBook`.
- **`TextPlane`** — renders text onto a Canvas 2D texture mapped to a `<mesh planeGeometry>`. Font, size, color, and opacity are all props.

### Color palette (defined in `animationMath.js` and mirrored as CSS vars in `styles.css`)

| Token | Hex |
|---|---|
| `offBlack` / `--off-black` | `#12110f` |
| `offWhite` / `--off-white` | `#efeee8` |
| `gray` / `--gray` | `#8f8d86` |
| `maroon` / `--maroon` | `#24221f` |

### Typography

Three self-hosted woff2 fonts in `public/fonts/`: **Manrope 400** (body/UI), **Inter Tight 500** (chrome/labels), **Teko 600** (large CTA display text). `TextPlane` renders to a Canvas texture so any CSS font string works as `fontFamily`.

### Reduced-motion fallback

`LandingPage` detects `prefers-reduced-motion: reduce` and renders a plain static `ReducedMotionFallback` component instead of the entire 3D scene.
