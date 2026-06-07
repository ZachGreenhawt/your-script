import { useEffect, useLayoutEffect, useState } from "react";

// ─── Hand-drawn mascot loader ────────────────────────────────────────────
// A full-screen overlay used between phases — the mascot illustration
// from /public/mascots, a wobbly pencil progress strip, and a rotating
// caption.  Two consumers:
//   1. LandingPage  → end-of-scroll handoff (writing.svg, default
//      "Sharpening pencils…" captions, *uncontrolled* — the bar ramps on
//      its own since there's no real work to measure)
//   2. PracticeApp  → API calls (sorting / listening mascots).  Passes a
//      *controlled* `progress` (0–1) + `caption` streamed from the backend
//      so the bar reflects real parsing stages and the caption names the
//      step actually running.
// Pass any mascot path + caption list to retheme it.

const DEFAULT_CAPTIONS = [
  "Sharpening pencils…",
  "Cueing your pages…",
  "Pulling up the script…",
  "Cueing the spotlight…",
];

export default function MascotLoader({
  phase,
  mascot = "/mascots/writing.svg",
  captions = DEFAULT_CAPTIONS,
  label = "Opening your script",
  progress = null,
  caption = "",
  note = "",
}) {
  const [captionIdx, setCaptionIdx] = useState(0);
  const [autoProgress, setAutoProgress] = useState(0);

  const isOpen = phase === "opening" || phase === "open";
  // When the parent hands us a real number we're "controlled": the bar
  // tracks actual backend progress instead of the self-driven ramp.
  const controlled = typeof progress === "number";

  // Reset the caption cycle whenever the mascot or caption list changes
  // so a new loading reason starts at its first line.
  useEffect(() => {
    setCaptionIdx(0);
  }, [mascot, captions]);

  useEffect(() => {
    // In controlled mode the caption follows the real stage, so we don't
    // cycle through the canned list.
    if (phase === "idle" || controlled) return undefined;
    const id = window.setInterval(() => {
      setCaptionIdx((i) => (i + 1) % captions.length);
    }, 950);
    return () => window.clearInterval(id);
  }, [phase, captions, controlled]);

  // Self-driven adaptive bar.  We can't get true byte-level progress, so the
  // bar ramps up while a load is active — decelerating as it nears ~92% so it
  // always feels like it's moving but never "finishes" early — then snaps to
  // 100% the moment the work completes (phase leaves the open state, just as
  // the overlay fades).
  //
  // This ramp runs even in *controlled* mode, where it acts as a floor: the
  // backend streams real checkpoints, but a proxy (Vite dev, Railway, a CDN)
  // can buffer the ndjson stream so those checkpoints all land at the very end.
  // Without a floor the bar would sit frozen until then.  We take the max of
  // the ramp and the real value, so the bar always visibly loads and snaps to
  // real progress whenever a checkpoint actually arrives ahead of the ramp.
  useLayoutEffect(() => {
    if (!isOpen) {
      setAutoProgress(100);
      return undefined;
    }
    // Reset before paint so a reopened loader never flashes the previous
    // run's full bar before retracting.
    setAutoProgress(0);
    const id = window.setInterval(() => {
      setAutoProgress((p) =>
        p >= 92 ? p : Math.min(92, p + Math.max(0.7, (92 - p) * 0.07)),
      );
    }, 130);
    return () => window.clearInterval(id);
  }, [isOpen, mascot]);

  const realPct = controlled ? Math.max(0, Math.min(100, progress * 100)) : 0;
  const pct = controlled ? Math.max(autoProgress, realPct) : autoProgress;
  const captionText = controlled && caption ? caption : captions[captionIdx];
  const captionKey = controlled ? caption || "…" : captionIdx;

  return (
    <div
      className={`mascot-loader ${isOpen ? "is-open" : ""}`}
      aria-live="polite"
      aria-label={label}
    >
      <div className="mascot-stage">
        <div className="mascot-figure">
          <img src={mascot} alt="" className="mascot-img" aria-hidden="true" />
        </div>

        {/* Hand-drawn progress strip — wobble rect outline + dashed
            pencil fill that scrubs left-to-right + three tick marks. */}
        <div className="mascot-progress" aria-hidden="true">
          <svg viewBox="0 0 220 24" preserveAspectRatio="none">
            <path
              d="M 4 6 Q 60 4 110 6 T 216 5 L 216 19 Q 160 21 110 19 T 4 20 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 60 12 L 60 16"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M 110 11 L 110 17"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M 160 12 L 160 16"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
          <div
            className="mascot-progress-fill"
            style={{
              width: `calc((100% - 14px) * ${Math.min(100, pct) / 100})`,
            }}
          />
        </div>

        <div className="mascot-caption">
          <span className="mascot-caption-text" key={captionKey}>
            {captionText}
          </span>
          <span className="mascot-caption-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>

        {note ? <p className="mascot-note">{note}</p> : null}
      </div>
    </div>
  );
}
