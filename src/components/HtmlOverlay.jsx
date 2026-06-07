import { useEffect, useRef, useState } from "react";
import { lerp, smoothstep, easeOutQuart } from "../utils/animationMath.js";

const WAVY_UNDERLINE =
  "M 4 12 Q 30 4 56 10 Q 82 18 108 10 Q 134 2 160 10 Q 186 18 212 10 Q 238 4 264 12";

const TITLE_RULE =
  "M 6 14 Q 90 9 200 12 T 420 11 T 640 12 T 860 10 Q 920 8 952 4";

const ARROW_TO_BOOK = "M 30 30 L 40 18 L 50 30";

const SECTION_NUMS = ["01", "02", "03", "04"];
const ABOUT_HREF = "/what-is-yourscript.html";
const FEEDBACK_HREF = "/feedback?from=landing&kind=say-hi";

// "Your Script" letters with a shuffled exit stagger, title scatters off
// rather than wiping when the user scrolls past the title.
const TITLE_CHARS = "Your Script".split("");
// One stagger slot per title character (11 for "Your Script").
const TITLE_EXIT_STAGGER = [4, 1, 8, 0, 6, 9, 3, 7, 2, 5, 10];

const dash = (length, draw) => ({
  strokeDasharray: length,
  strokeDashoffset: length * (1 - draw),
});

function sectionFor(progress) {
  if (progress < 0.22) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.74) return 2;
  return 3;
}

function scrollToBottom() {
  if (window.__lenis) {
    window.__lenis.scrollTo(document.documentElement.scrollHeight);
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }
}

export default function HtmlOverlay({ progress }) {
  const newScriptButtonRef = useRef(null);
  const [loaderActive, setLoaderActive] = useState(false);
  const [titleRevealed, setTitleRevealed] = useState(false);

  useEffect(() => {
    const onClick = () => setLoaderActive(true);
    window.addEventListener("newScriptClick", onClick);
    return () => window.removeEventListener("newScriptClick", onClick);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setTitleRevealed(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const button = newScriptButtonRef.current;
    if (!button) return;
    const click = (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("newScriptClick"));
    };
    const enter = () =>
      window.dispatchEvent(new CustomEvent("newScriptHover", { detail: true }));
    const leave = () =>
      window.dispatchEvent(
        new CustomEvent("newScriptHover", { detail: false }),
      );
    button.addEventListener("click", click);
    button.addEventListener("mouseenter", enter);
    button.addEventListener("mouseleave", leave);
    return () => {
      button.removeEventListener("click", click);
      button.removeEventListener("mouseenter", enter);
      button.removeEventListener("mouseleave", leave);
    };
  }, []);

  const gate = loaderActive ? 0 : 1;
  const introOpacity = (1 - smoothstep(0.035, 0.16, progress)) * gate;
  const chromeOpacity = (1 - smoothstep(0.12, 0.3, progress)) * introOpacity;
  const ctaFadeOut = (1 - smoothstep(0.965, 0.995, progress)) * gate;
  const footerOpacity = smoothstep(0.94, 0.995, progress) * gate;
  const startArrowOpacity = smoothstep(0.925, 0.985, progress) * gate;
  const startArrowDraw = smoothstep(0.94, 1.0, progress);
  const ctaUnderlineDraw = smoothstep(0.81, 0.94, progress);
  const newScriptArmed = progress > 0.96 && !loaderActive;
  const scrollMeter = smoothstep(0, 0.18, progress);

  const titleOutActive = progress > 0.28;
  const ornamentScrollOut = 1 - smoothstep(0.3, 0.4, progress);
  const titleCharOut = (i) => {
    const stagger = (TITLE_EXIT_STAGGER[i] ?? i) * 0.008;
    return 1 - smoothstep(0.3 + stagger, 0.42 + stagger, progress);
  };

  const ctaWindow = (lo, hi) => easeOutQuart(smoothstep(lo, hi, progress));
  const ctaReveal = [
    ctaWindow(0.7, 0.82),
    ctaWindow(0.735, 0.855),
    ctaWindow(0.77, 0.9),
  ];
  const lineStyle = (reveal) => ({
    opacity: reveal * ctaFadeOut,
    transform: `translate3d(0, ${(1 - reveal) * 0.28}em, 0) scale(${lerp(0.985, 1, reveal)})`,
  });

  const section = sectionFor(progress);
  const sectionFill = smoothstep(
    [0, 0.22, 0.5, 0.74][section],
    [0.22, 0.5, 0.74, 1][section],
    progress,
  );
  const fadeStyle =
    titleOutActive ?
      { opacity: ornamentScrollOut, transition: "opacity 120ms linear" }
    : undefined;

  return (
    <>
      <div className="stage-background">
        <div
          className={`hero-title ${titleRevealed ? "is-revealed" : ""}`}
          style={{ opacity: ctaFadeOut * gate }}
        >
          <h1 className="page-title" aria-label="Your Script">
            {TITLE_CHARS.map((char, i) => {
              const out = titleCharOut(i);
              const override =
                titleOutActive ?
                  {
                    opacity: out,
                    transform: `translate3d(0, ${(1 - out) * -14}px, 0)`,
                    transition: "opacity 110ms linear, transform 110ms linear",
                  }
                : null;
              return (
                <span
                  key={i}
                  className={
                    char === " " ? "page-title-space" : "page-title-char"
                  }
                  style={{ "--char-i": i, ...(override || {}) }}
                  aria-hidden={char === " " ? "true" : undefined}
                >
                  {char === " " ? " " : char}
                </span>
              );
            })}
          </h1>

          <svg
            className="hero-rule"
            viewBox="0 0 960 24"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={fadeStyle}
          >
            <path
              d={TITLE_RULE}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="hero-subtitle" style={fadeStyle}>
            a line rehearsal companion
          </div>
        </div>

        <div className="cta-stack" aria-hidden={progress < 0.7}>
          <div className="cta-line cta-l1" style={lineStyle(ctaReveal[0])}>
            UPLOAD
          </div>
          <div className="cta-line cta-l2-wrap" style={lineStyle(ctaReveal[1])}>
            <span className="cta-l2">a play to</span>
            <svg
              className="cta-underline"
              viewBox="0 0 268 24"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={WAVY_UNDERLINE}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={dash(420, ctaUnderlineDraw)}
              />
            </svg>
          </div>
          <div className="cta-line cta-l3" style={lineStyle(ctaReveal[2])}>
            GET STARTED
          </div>
        </div>
      </div>

      <div className="html-overlay">
        <header className="site-chrome" style={{ opacity: chromeOpacity }}>
          <a className="chrome-link chrome-mark squiggle-hover" href="#top">
            Your Script
          </a>
          <span className="chrome-center">Landing · 2026</span>
          <a
            className="chrome-link chrome-cta squiggle-hover"
            href="#upload"
            onClick={(e) => {
              e.preventDefault();
              scrollToBottom();
            }}
          >
            Upload
            <svg
              className="chrome-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </header>

        <nav
          className="section-index"
          style={{
            opacity: chromeOpacity * 0.85,
            transform: `translate3d(${smoothstep(0.08, 0.24, progress) * -18}px, 0, 0)`,
          }}
          aria-label="Scene index"
        >
          <span className="is-active" aria-current="step">
            <strong>{SECTION_NUMS[section]}</strong>
            <span className="section-dot-track" aria-hidden="true">
              <span
                className="section-dot-fill"
                style={{ transform: `scaleX(${sectionFill})` }}
              />
            </span>
          </span>
        </nav>

        <div
          className="scroll-hint"
          style={{ opacity: introOpacity * 0.62 }}
          aria-hidden="true"
        >
          <span>Scroll</span>
          <span className="scroll-meter" aria-hidden="true">
            <span style={{ transform: `scaleY(${scrollMeter})` }} />
          </span>
        </div>

        <div
          className="start-here"
          style={{
            opacity: startArrowOpacity,
            transform: `translate(-50%, ${(1 - startArrowOpacity) * 14}px)`,
          }}
          aria-hidden="true"
        >
          <svg className="start-arrow" viewBox="0 0 80 52">
            <path
              d={ARROW_TO_BOOK}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={dash(220, startArrowDraw)}
            />
          </svg>
          <span>Begin</span>
        </div>

        <button
          ref={newScriptButtonRef}
          type="button"
          className="new-script-hitbox"
          aria-label="Upload a new script"
          style={{
            opacity: newScriptArmed ? 1 : 0,
            pointerEvents: newScriptArmed ? "auto" : "none",
          }}
        />

        <footer
          className="end-footer"
          style={{
            opacity: footerOpacity,
            transform: `translate3d(0, ${(1 - footerOpacity) * 10}px, 0)`,
          }}
          aria-hidden={progress < 0.93}
        >
          <span>Your Script</span>
          <nav className="end-footer-links" aria-label="Footer links">
            <a
              className="end-footer-link"
              href={ABOUT_HREF}
              onClick={(e) => {
                e.preventDefault();
                window.location.assign(ABOUT_HREF);
              }}
            >
              What is Your Script?
            </a>
            <span className="end-footer-separator" aria-hidden="true">
              |
            </span>
            <a
              className="end-footer-link"
              href={FEEDBACK_HREF}
              onClick={(e) => {
                e.preventDefault();
                window.location.assign(FEEDBACK_HREF);
              }}
            >
              Built by a student. Say hi!
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}
