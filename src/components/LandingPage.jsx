import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Scene from "./Scene.jsx";
import HtmlOverlay from "./HtmlOverlay.jsx";
import BackgroundAtmosphere from "./BackgroundAtmosphere.jsx";
import MascotLoader from "./MascotLoader.jsx";
import ScrollProgress from "./ScrollProgress.jsx";
import useScrollTimeline from "../hooks/useScrollTimeline.js";

gsap.registerPlugin(ScrollTrigger);

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function ReducedMotionFallback() {
  return (
    <main className="reduced-motion-page">
      <div className="grain-layer" />
      <section className="reduced-motion-inner" aria-label="Your Script">
        <p className="eyebrow">Your Script</p>
        <h1>Upload a play to get started</h1>
        <p>Upload a play. Choose your role. Practice your lines.</p>
        <button
          type="button"
          className="new-script-fallback"
          onClick={() => window.location.assign("/upload")}
        >
          New Script
        </button>
      </section>
    </main>
  );
}

export default function LandingPage() {
  const scrollRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const progress = useScrollTimeline(scrollRef, !reducedMotion);

  // Sequenced beats for the New Script book click:
  //   "idle"     – nothing shown
  //   "opening"  – mascot fades in on top of the still-animating book
  //   "open"     – progress bar fills, captions cycle
  //   then we hand off to the upload route once the bar finishes.
  const [loaderPhase, setLoaderPhase] = useState("idle");

  useEffect(() => {
    const handler = () => {
      // Give the 3D book a beat to open in place, *then* layer the mascot.
      window.setTimeout(() => setLoaderPhase("opening"), 650);
      window.setTimeout(() => setLoaderPhase("open"), 1300);
      window.setTimeout(() => window.location.assign("/upload"), 3200);
    };
    window.addEventListener("newScriptClick", handler);
    return () => window.removeEventListener("newScriptClick", handler);
  }, []);

  useEffect(() => {
    let rafId = 0;
    let timeoutId = 0;
    const startedAt = performance.now();
    const duration = 1450;

    const tick = (time) => {
      const next = Math.min(
        100,
        Math.round(((time - startedAt) / duration) * 100),
      );
      setLoadingPercent(next);

      if (next < 100) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      timeoutId = window.setTimeout(() => setLoading(false), 320);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    // Expose on window so HtmlOverlay can call lenis.scrollTo() without
    // needing to thread a ref all the way down the tree.
    window.__lenis = lenis;

    let frameId = 0;
    const raf = (time) => {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    };

    lenis.on("scroll", ScrollTrigger.update);
    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
      window.__lenis = null;
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return <ReducedMotionFallback />;
  }

  const loaderActive = loaderPhase !== "idle";

  return (
    <main
      ref={scrollRef}
      className={`landing-scroll ${loaderActive ? "is-loader-active" : ""}`}
    >
      <div
        className={`loader-screen ${loading ? "is-loading" : "is-loaded"}`}
        aria-hidden={!loading}
      >
        <div className="loader-frame">
          <div className="loader-meta">
            <span>Your Script</span>
            <strong>2026 / Edition 01</strong>
          </div>
          {/* Small mascot peeking - gives the loading screen a face. */}
          <div className="loader-mascot" aria-hidden="true">
            <img src="/mascots/listening.svg" alt="" />
          </div>
          <div className="loader-count">
            <span>{String(loadingPercent).padStart(3, "0")}</span>
            <em>/100</em>
          </div>
          <div className="loader-track">
            <div
              className="loader-fill"
              style={{ transform: `scaleX(${loadingPercent / 100})` }}
            />
          </div>
          <div className="loader-meta">
            <span>Landing</span>
            <strong>Loading</strong>
          </div>
        </div>
      </div>
      <div className="landing-pin">
        <BackgroundAtmosphere progress={progress} />
        <Scene progress={progress} />
        <HtmlOverlay progress={progress} />
        <ScrollProgress progress={progress} />
        <div className="grain-layer" aria-hidden="true" />
      </div>

      <MascotLoader phase={loaderPhase} />
    </main>
  );
}
