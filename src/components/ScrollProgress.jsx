// ─── Vertical scroll progress hairline ───────────────────────────────────
// Uses transforms only so scroll updates stay on the compositor instead of
// forcing layout work every frame.

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function ScrollProgress({ progress }) {
  const pct = clamp01(progress);
  return (
    <div className="scroll-progress" aria-hidden="true">
      <div className="scroll-progress-rail" />
      <div
        className="scroll-progress-fill"
        style={{ transform: `scaleY(${pct})` }}
      />
    </div>
  );
}

export default ScrollProgress;
