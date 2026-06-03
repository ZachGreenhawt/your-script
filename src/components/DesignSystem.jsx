// ─── Your Script — Living Design System ──────────────────────────────────────
// A visual reference for all tokens, components, and patterns used across the
// app.  Rendered using the actual CSS + components so it never drifts from
// reality.  Access at /design-system (dev only; not linked from the main UI).

import { useEffect, useRef, useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ id, title, children }) {
  return (
    <section className="ds-section" id={id}>
      <h2 className="ds-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children, gap = "16px" }) {
  return (
    <div className="ds-row">
      {label ? <p className="ds-row-label">{label}</p> : null}
      <div className="ds-row-items" style={{ gap }}>
        {children}
      </div>
    </div>
  );
}

function Swatch({ token, hex, textColor = "var(--ink)" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button className="ds-swatch" onClick={copy} title={`Copy ${hex}`}>
      <span className="ds-swatch-chip" style={{ background: hex }} />
      <span className="ds-swatch-token">{token}</span>
      <span className="ds-swatch-hex">{copied ? "Copied!" : hex}</span>
    </button>
  );
}

function SemanticSwatch({ name, hex, use }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ds-semantic-swatch"
      onClick={() => {
        navigator.clipboard.writeText(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      <span className="ds-swatch-chip" style={{ background: hex, border: "1.5px solid rgba(44,39,34,.1)" }} />
      <span className="ds-swatch-token">{name}</span>
      <span className="ds-swatch-hex">{copied ? "Copied!" : hex}</span>
      <span className="ds-swatch-use">{use}</span>
    </button>
  );
}

// Minimal RoughBox reimplementation so DesignSystem has no dependency on
// PracticeApp internals.
function buildRoughRect(w, h, seed = 1) {
  const amp = Math.min(1.6, Math.min(w, h) * 0.04);
  const wob = (n) => Math.sin(seed * 7.3 + n * 1.7) * amp;
  const r = Math.min(8, h * 0.18, w * 0.18);
  return [
    `M ${r + wob(1)} ${wob(2)}`,
    `L ${w - r + wob(3)} ${wob(4) - 0.5}`,
    `Q ${w + wob(5)} ${wob(6)} ${w + wob(7) - 0.5} ${r + wob(8)}`,
    `L ${w + wob(9) - 0.5} ${h - r + wob(10)}`,
    `Q ${w + wob(11)} ${h + wob(12)} ${w - r + wob(13)} ${h + wob(14) - 0.5}`,
    `L ${r + wob(15)} ${h + wob(16) - 0.5}`,
    `Q ${wob(17)} ${h + wob(18)} ${wob(19) + 0.5} ${h - r + wob(20)}`,
    `L ${wob(21) + 0.5} ${r + wob(22)}`,
    `Q ${wob(23)} ${wob(24)} ${r + wob(25)} ${wob(26) + 0.5}`,
    `Z`,
  ].join(" ");
}

function RoughBoxDemo({ w, h, seed = 1, double = false, strokeWidth = 1.4, style }) {
  const p1 = buildRoughRect(w, h, seed);
  const p2 = double ? buildRoughRect(w, h, seed + 11) : null;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ overflow: "visible", ...style }}
      aria-hidden="true"
    >
      <path d={p1} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {p2 ? (
        <path d={p2} fill="none" stroke="currentColor" strokeWidth={strokeWidth * 0.7}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.5" />
      ) : null}
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystem() {
  useEffect(() => {
    document.body.style.overflow = "";
    return () => { document.body.style.overflow = "hidden"; };
  }, []);

  return (
    <div className="ds-page">
      {/* Header */}
      <header className="ds-header">
        <a className="ds-back" href="/upload">← Back to app</a>
        <div className="ds-header-text">
          <p className="ds-header-eyebrow">Your Script</p>
          <h1 className="ds-header-title">Design System</h1>
          <p className="ds-header-sub">
            Living reference for tokens, components, and patterns.
            Built from the real CSS — never out of date.
          </p>
        </div>
      </header>

      <main className="ds-main">

        {/* ── 1. Color ─────────────────────────────────────────────────── */}
        <Section id="color" title="Color">
          <Row label="Core palette">
            <Swatch token="--ink / --off-black" hex="#2c2722" />
            <Swatch token="--off-white" hex="#f2f0e8" />
            <Swatch token="--paper" hex="#e6e3d8" />
            <Swatch token="--pencil" hex="#5a5249" />
            <Swatch token="--gray" hex="#9a958c" />
            <Swatch token="--maroon" hex="#3d342a" />
          </Row>
          <Row label="Semantic — feedback only">
            <SemanticSwatch name="wrong / stuck" hex="#8b3d3d" use="Wrong-answer states, stuck badge" />
            <SemanticSwatch name="review" hex="#8a7228" use="Review / needs-work states" />
            <SemanticSwatch name="correct / right" hex="#315f5b" use="Correct-answer states, progress badge" />
          </Row>
          <Row label="Surface fills (alpha)">
            <div className="ds-fill-chip" style={{ background: "rgba(44,39,34,.16)" }}>
              <code>rgba(ink, .16)</code><span>Progress rail fill</span>
            </div>
            <div className="ds-fill-chip" style={{ background: "rgba(44,39,34,.08)" }}>
              <code>rgba(ink, .08)</code><span>Hover / active tint</span>
            </div>
            <div className="ds-fill-chip" style={{ background: "rgba(20,17,14,.42)", color: "#f2f0e8" }}>
              <code>rgba(20,17,14,.42)</code><span>Modal backdrop</span>
            </div>
          </Row>
          <p className="ds-note">
            <strong>Rule:</strong> semantic colours (wrong / review / right) are reserved for feedback states only. Everything else uses core palette tokens.
          </p>
        </Section>

        {/* ── 2. Typography ────────────────────────────────────────────── */}
        <Section id="typography" title="Typography">
          <Row label="Display — Teko 600">
            <div className="ds-type-block">
              <p style={{ fontFamily: '"Teko","Inter Tight",sans-serif', fontWeight: 600, fontSize: "4rem", lineHeight: 1, letterSpacing: ".01em", margin: 0 }}>Upload a script</p>
              <code>Teko 600 · 4–6rem · lh 0.92 · ls 0.01em</code>
            </div>
          </Row>
          <Row label="UI / chrome — Inter Tight 500">
            <div className="ds-type-block">
              <p style={{ fontFamily: '"Inter Tight",Manrope,sans-serif', fontWeight: 500, fontSize: "1rem", margin: 0 }}>Your Script · Full Run · Line Rehearsal</p>
              <code>Inter Tight 500 · 0.72–1rem</code>
            </div>
          </Row>
          <Row label="Eyebrow — Inter Tight 500 uppercase">
            <div className="ds-type-block">
              <p style={{ fontFamily: '"Inter Tight",Manrope,sans-serif', fontWeight: 500, fontSize: ".72rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--gray)", margin: 0 }}>Line rehearsal · Step 1 of 3</p>
              <code>Inter Tight 500 · 0.72rem · ls 0.22em · uppercase · --gray</code>
            </div>
          </Row>
          <Row label="Caption / italic — Inter Tight 500 italic">
            <div className="ds-type-block">
              <p style={{ fontFamily: '"Inter Tight",Manrope,sans-serif', fontWeight: 500, fontStyle: "italic", fontSize: ".92rem", color: "var(--pencil)", margin: 0 }}>Drop in your script — we'll pull every cue for your part.</p>
              <code>Inter Tight 500 italic · ~0.92–1.1rem · --pencil</code>
            </div>
          </Row>
          <Row label="Body — Manrope 400">
            <div className="ds-type-block">
              <p style={{ fontFamily: '"Manrope",Inter,sans-serif', fontWeight: 400, fontSize: "1rem", lineHeight: 1.5, margin: 0 }}>
                The feedback text after a line attempt. Also used for review rows and longer prose anywhere it appears.
              </p>
              <code>Manrope 400 · 1rem · lh 1.45–1.6</code>
            </div>
          </Row>
          <p className="ds-note">
            <strong>Never</strong> use <code>text-transform: capitalize</code> on display headings — pass sentence-case strings and let the font render them directly.
          </p>
        </Section>

        {/* ── 3. Spacing & Easing ──────────────────────────────────────── */}
        <Section id="spacing" title="Spacing & Easing">
          <Row label="Spacing scale (clamp-based, not fixed)">
            <div className="ds-space-grid">
              {[
                ["4px", "micro gap"],
                ["8–12px", "intra-component"],
                ["16–24px", "component gap"],
                ["clamp(24,3vw,44)px", "section gap"],
                ["clamp(40,6vh,72)px", "page heading margin"],
              ].map(([val, use]) => (
                <div key={val} className="ds-space-row">
                  <div className="ds-space-bar" style={{ width: val.includes("clamp") ? 44 : parseInt(val) * 2 }} />
                  <code>{val}</code>
                  <span>{use}</span>
                </div>
              ))}
            </div>
          </Row>
          <Row label="Easing tokens">
            <div className="ds-ease-grid">
              {[
                ["--ease-out-expo", "cubic-bezier(0.16,1,0.3,1)", "UI transitions, most things"],
                ["--ease-out-quart", "cubic-bezier(0.32,0.72,0,1)", "Large layout moves"],
                ["--ease-in-out-quart", "cubic-bezier(0.65,0,0.35,1)", "Mascot bob, breathing"],
                ["--ease-house", "cubic-bezier(0.22,0.61,0.36,1)", "Toggle track"],
              ].map(([tok, val, use]) => (
                <div key={tok} className="ds-ease-row">
                  <code>{tok}</code>
                  <span className="ds-ease-val">{val}</span>
                  <span className="ds-ease-use">{use}</span>
                </div>
              ))}
            </div>
          </Row>
        </Section>

        {/* ── 4. RoughBox ──────────────────────────────────────────────── */}
        <Section id="roughbox" title="RoughBox — the hand-drawn frame">
          <p className="ds-prose">
            Every interactive surface uses a <strong>RoughBox</strong> SVG (generated by <code>buildRoughRect</code> / <code>buildRoughPill</code>) instead of CSS borders. The path is deterministic-random (sin-seeded) so a component's box always wobbles the same way, but no two are identical. The SVG is regenerated on resize via ResizeObserver — the box always fits its content exactly.
          </p>
          <Row label="Variants">
            <div className="ds-roughbox-demo" style={{ color: "var(--ink)" }}>
              <div>
                <RoughBoxDemo w={120} h={48} seed={1} />
                <code>rect · single</code>
              </div>
              <div>
                <RoughBoxDemo w={120} h={48} seed={3} double />
                <code>rect · double</code>
              </div>
              <div>
                <RoughBoxDemo w={100} h={36} seed={5} strokeWidth={2} />
                <code>strokeWidth 2</code>
              </div>
            </div>
          </Row>
          <Row label="Seeds in use">
            <div className="ds-roughbox-demo" style={{ color: "var(--ink)" }}>
              {[1, 2, 3, 7, 11, 42].map((s) => (
                <div key={s}>
                  <RoughBoxDemo w={80} h={36} seed={s} />
                  <code>seed {s}</code>
                </div>
              ))}
            </div>
          </Row>
          <Row label="Boil animation">
            <div className="ds-roughbox-demo ds-boil-demo" style={{ color: "var(--ink)" }}>
              <div>
                <div className="ds-boil-wrap">
                  {[1, 8, 16].map((s, i) => (
                    <svg key={s} className={`rough-box ds-boil-frame boil-frame boil-frame-${i + 1} is-boil`}
                      viewBox="0 0 120 48" style={{ overflow: "visible", position: i === 0 ? "relative" : "absolute", inset: 0, width: 120, height: 48 }}>
                      <path d={buildRoughRect(120, 48, s)} fill="none" stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  ))}
                </div>
                <code>is-boil (always)</code>
              </div>
            </div>
          </Row>
          <p className="ds-note">
            <strong>Rule:</strong> never use CSS <code>border</code> for UI chrome. All frames use RoughBox. The cue card uses <code>boil</code> (always cycling at ~4fps); interactive buttons use <code>boil="hover"</code> (activates on pointer).
          </p>
        </Section>

        {/* ── 5. Components ────────────────────────────────────────────── */}
        <Section id="components" title="Components">

          {/* PencilButton */}
          <Row label="PencilButton">
            <div className="ds-component-row">
              <button className="pencil-btn">
                <svg className="rough-box pencil-btn-frame" viewBox="0 0 120 44" style={{ overflow: "visible" }}>
                  <path d={buildRoughRect(120, 44, 2)} fill="none" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="pencil-btn-label">Parse script ›</span>
              </button>
              <button className="pencil-btn" disabled>
                <svg className="rough-box pencil-btn-frame" viewBox="0 0 100 44" style={{ overflow: "visible" }}>
                  <path d={buildRoughRect(100, 44, 3)} fill="none" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="pencil-btn-label">Disabled</span>
              </button>
            </div>
            <code className="ds-code-hint">PencilButton — transparent bg, RoughBox frame, Inter Tight</code>
          </Row>

          {/* Hand-drawn checkbox */}
          <Row label="Paper checkbox (settings)">
            <div className="ds-component-row">
              {[
                { label: "Timed mode", checked: true },
                { label: "Case sensitive", checked: false },
              ].map(({ label, checked }) => (
                <label key={label} className={`paper-check ${checked ? "is-checked" : ""}`} style={{ pointerEvents: "none" }}>
                  <input type="checkbox" defaultChecked={checked} readOnly style={{ position: "absolute", opacity: 0 }} />
                  <span className="paper-check-box" aria-hidden="true">
                    <svg className="rough-box paper-check-frame" viewBox="0 0 30 30" style={{ overflow: "visible", position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                      <path d={buildRoughRect(30, 30, label.length)} fill="none" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {checked ? (
                      <svg className="paper-check-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                        style={{ opacity: 1, transform: "none" }}>
                        <path d="M4.5 13 Q 6.8 15.4 9 17.8 Q 13.4 11 19.5 5.8" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="paper-check-label">{label}</span>
                </label>
              ))}
            </div>
            <code className="ds-code-hint">paper-check — RoughBox frame + ink marker tick. Used in settings modal only.</code>
          </Row>

          {/* Status badges */}
          <Row label="StatusBadge (practice tallies)">
            <div className="ds-component-row" style={{ alignItems: "flex-start" }}>
              {[
                { tone: "wrong", label: "Stuck", value: 2, mascot: "/mascots/Stuck.svg" },
                { tone: "review", label: "Reviewing", value: 1, mascot: "/mascots/Reviewing.svg" },
                { tone: "right", label: "Progress", value: 5, mascot: "/mascots/Making Progress.svg" },
              ].map(({ tone, label, value, mascot }) => (
                <div key={tone} className={`status-badge tone-${tone}`}>
                  <div className="status-badge-card">
                    <svg className="rough-box status-badge-frame" viewBox="0 0 150 68" style={{ overflow: "visible", position: "absolute", inset: 0 }}>
                      <path d={buildRoughRect(150, 68, tone.length)} fill="none" stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <img src={mascot} alt="" className="status-badge-icon" aria-hidden="true" />
                    <strong>{value}</strong>
                  </div>
                  <span className="status-badge-label">{label}</span>
                </div>
              ))}
            </div>
            <code className="ds-code-hint">StatusBadge — tone-wrong / tone-review / tone-right. Semantic colors only on tone variants.</code>
          </Row>

          {/* Hint card */}
          <Row label="Hint card / aside button">
            <div className="ds-component-row">
              <div className="hint-card is-shown" style={{ position: "relative", pointerEvents: "none" }}>
                <svg className="rough-box hint-card-frame" viewBox="0 0 200 68" style={{ overflow: "visible", position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  <path d={buildRoughRect(200, 68, 7)} fill="none" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <img src="/mascots/Hint.svg" alt="" className="hint-card-icon" aria-hidden="true" />
                <div className="hint-card-text">
                  <strong>Hint?</strong>
                  <span>First few words</span>
                </div>
              </div>
            </div>
            <code className="ds-code-hint">hint-card — RoughBox frame + mascot icon + two-line text. Used in aside rail.</code>
          </Row>

          {/* Mode toggle */}
          <Row label="Mode toggle">
            <div className="mode-toggle" style={{ position: "relative" }}>
              <svg className="rough-box mode-toggle-frame" viewBox="0 0 280 44" style={{ overflow: "visible", position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <path d={buildRoughRect(280, 44, 9)} fill="none" stroke="currentColor" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="mode-toggle-label is-active">Active Recall</span>
              <span className="mode-toggle-label">Flashcards</span>
            </div>
            <code className="ds-code-hint">ModeToggle — pill RoughBox, two labels, active label gets ink weight.</code>
          </Row>
        </Section>

        {/* ── 6. Mascots ───────────────────────────────────────────────── */}
        <Section id="mascots" title="Mascots">
          <p className="ds-prose">
            Pure black ink SVGs from <code>/public/mascots/</code>. Rendered with a soft drop shadow so they feel like they're standing on the paper. They animate with <code>mascot-bob</code> / <code>mascot-breathe</code> keyframes in idle states.
          </p>
          <Row label="Full cast">
            <div className="ds-mascot-grid">
              {[
                ["/mascots/Primary.svg", "Primary"],
                ["/mascots/writing.svg", "Writing"],
                ["/mascots/listening.svg", "Listening"],
                ["/mascots/Sorting Cues.svg", "Sorting Cues"],
                ["/mascots/Listening for Cue.svg", "Listening for Cue"],
                ["/mascots/Making Progress.svg", "Making Progress"],
                ["/mascots/Stuck.svg", "Stuck"],
                ["/mascots/Reviewing.svg", "Reviewing"],
                ["/mascots/Hint.svg", "Hint"],
                ["/mascots/Writing Something Great.svg", "Writing Something Great"],
              ].map(([src, name]) => (
                <div key={src} className="ds-mascot-item">
                  <img src={src} alt={name} className="ds-mascot-img" />
                  <code>{name}</code>
                </div>
              ))}
            </div>
          </Row>
          <Row label="Usage map">
            <div className="ds-usage-table">
              {[
                ["Primary.svg", "Upload screen (upload mascot)"],
                ["writing.svg", "MascotLoader — uncontrolled (LandingPage handoff)"],
                ["Sorting Cues.svg", "MascotLoader — busy=analyze"],
                ["Listening for Cue.svg", "MascotLoader — busy=parse"],
                ["Making Progress.svg", "StatusBadge tone-right (Progress)"],
                ["Stuck.svg", "StatusBadge tone-wrong (Stuck)"],
                ["Reviewing.svg", "StatusBadge tone-review / Reviewing"],
                ["Hint.svg", "Hint card in practice aside"],
                ["Writing Something Great.svg", "Foot progress rail mascot (rides the bar)"],
                ["listening.svg", "Dashboard empty state"],
              ].map(([file, use]) => (
                <div key={file} className="ds-usage-row">
                  <code>{file}</code>
                  <span>{use}</span>
                </div>
              ))}
            </div>
          </Row>
        </Section>

        {/* ── 7. Patterns ──────────────────────────────────────────────── */}
        <Section id="patterns" title="Patterns">

          <Row label="Paper backdrop (notebook ruled lines)">
            <div style={{ position: "relative", width: 320, height: 120, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              <div className="paper-backdrop" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
                <span className="paper-margin" />
                <span className="paper-rules" />
              </div>
              <div style={{ position: "relative", zIndex: 1, padding: "16px 24px", fontFamily: '"Inter Tight",sans-serif', fontSize: ".88rem", color: "var(--ink)", opacity: .6 }}>
                Ruled lines + left margin
              </div>
            </div>
            <code className="ds-code-hint">PaperBackdrop — fixed to the practice-page viewport. --paper bg, repeating-linear-gradient rules, solid left margin.</code>
          </Row>

          <Row label="Phase chrome (top bar)">
            <div className="ds-chrome-demo site-chrome practice-chrome" style={{ position: "relative", transform: "none", inset: "auto", borderBottom: "1px solid rgba(44,39,34,.1)", marginBottom: 8 }}>
              <span className="chrome-link chrome-mark">Your Script</span>
              <span className="chrome-center">Full Run</span>
              <div className="chrome-right">
                <a className="chrome-link chrome-cta" href="#" onClick={e => e.preventDefault()}>
                  New script
                  <svg className="chrome-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ transform: "scaleX(-1)" }}>
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
            <code className="ds-code-hint">site-chrome practice-chrome — three-column flex. Mark left, phase crumb centre, action right. CTA → /upload once in-session, / from upload screen only.</code>
          </Row>

          <Row label="Grain layer">
            <div style={{ position: "relative", width: 160, height: 80, borderRadius: 4, overflow: "hidden", background: "var(--off-white)", flexShrink: 0 }}>
              <div className="grain-layer" style={{ position: "absolute", inset: 0 }} aria-hidden="true" />
              <span style={{ position: "relative", zIndex: 1, display: "block", padding: "30px 16px", fontFamily: '"Inter Tight",sans-serif', fontSize: ".78rem", color: "var(--ink)", textAlign: "center", opacity: .5 }}>grain overlay</span>
            </div>
            <code className="ds-code-hint">grain-layer — fixed pointer-events:none div on every page. CSS radial-gradient film-grain effect, opacity 0.028.</code>
          </Row>

          <Row label="Hand-drawn underline">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--ink)" }}>
              <svg viewBox="0 0 268 24" preserveAspectRatio="none" width={268} height={14} style={{ display: "block", overflow: "visible" }}>
                <path d="M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14"
                  fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <code className="ds-code-hint">HandUnderline — used under every PaperHeading h1 and in the settings modal.</code>
            </div>
          </Row>
        </Section>

        {/* ── 8. Animation catalogue ───────────────────────────────────── */}
        <Section id="animation" title="Animation catalogue">
          <p className="ds-prose">
            All animations are <strong>transform + opacity only</strong>. Every playful motion is gated behind <code>@media (prefers-reduced-motion: reduce)</code> at the bottom of <code>styles.css</code>.
          </p>
          <div className="ds-anim-table">
            {[
              ["mascot-breathe", "2.8–3.6s", "Loader / dashboard mascot idle bob"],
              ["mascot-bob", "3.4s", "Foot-progress rail mascot"],
              ["icon-tip", "480ms", "Mascot icon tip on hover (hint/grade/badge)"],
              ["boil-cycle", "0.44–0.72s steps(1)", "RoughBox sketch boil (always: cue card; hover: buttons)"],
              ["stat-stamp", "560ms", "Number stamp-in when tally increments"],
              ["stat-hop", "560ms", "Mascot hop when tally increments"],
              ["spark-pop", "900ms", "Correct-answer confetti burst (8 sparks)"],
              ["flag-wave", "1.05s", "Finish-line flag wave at 100% progress"],
              ["stage-reveal-in", "320–360ms", "Cue card content enter"],
              ["wizard-step-in", "280ms", "Wizard step enter"],
              ["settings-pop-in", "320ms", "Settings modal enter"],
              ["toast-in", "300ms", "Error toast enter"],
              ["mascot-caption-in", "320ms", "Loader caption text swap"],
              ["mascot-dot", "1.3s", "Loader bouncing dots"],
            ].map(([name, duration, use]) => (
              <div key={name} className="ds-anim-row">
                <code>{name}</code>
                <span className="ds-anim-dur">{duration}</span>
                <span className="ds-anim-use">{use}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 9. Design rules ──────────────────────────────────────────── */}
        <Section id="rules" title="Design rules">
          <div className="ds-rules">
            {[
              ["Never use CSS border for UI chrome", "All frames use RoughBox SVGs. CSS borders break the hand-drawn look."],
              ["Sentence case on all headings", "Pass sentence-case strings. Never use text-transform: capitalize — it capitalises every word."],
              ["No colour outside the palette", "Core tokens for structure (ink/pencil/paper). Semantic colours (wrong/review/right) for feedback states only. No teal in the settings, no maroon in the upload screen."],
              ["Overflow without page scroll", "body overflow: hidden always. Scrollable content uses overflow-y: auto on the inner container. The page itself never scrolls."],
              ["Fit-to-box text", "The practice cue card uses --stage-scale (ResizeObserver + while loop, floor 0.5) to shrink text until it fits without overflowing. Never add height to .stage-body — it breaks the measurement."],
              ["Correct-burst is a sibling, not a child", "The confetti overlay (.correct-burst) must be a sibling of .stage-body — never inside it — so it doesn't affect the scrollHeight that drives the fit-shrink."],
              ["Mascots are pure black ink", "Filter: drop-shadow only. No hue-rotate, no colour overlays. They sit on paper using their natural ink tone."],
              ["Landing page is off-limits", "The 3D scroll-driven landing (/) uses Three.js + GSAP ScrollTrigger. Never touch LandingPage.jsx or Scene.jsx in UI work."],
            ].map(([rule, detail]) => (
              <div key={rule} className="ds-rule">
                <strong className="ds-rule-title">{rule}</strong>
                <p className="ds-rule-detail">{detail}</p>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  );
}
