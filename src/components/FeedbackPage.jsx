import { useEffect, useMemo, useRef, useState } from "react";
import {
  FEEDBACK_EMAIL,
  sendFeedback,
  pageContext,
  readStashedError,
  clearStashedError,
} from "../feedback.js";
import {
  readSnapshot,
  clearSnapshot,
  formatDiagnostics,
} from "../diagnostics.js";

const SCRIPT_SCREENS = new Set(["upload", "setup", "practice", "done"]);
const HAND_UNDERLINE =
  "M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    "Z",
  ].join(" ");
}

function buildRoughPill(w, h, seed = 1) {
  const amp = Math.min(1.4, Math.min(w, h) * 0.04);
  const wob = (n) => Math.sin(seed * 6.1 + n * 1.9) * amp;
  const r = Math.min(h / 2, w / 2);
  const cp = r * 0.55;

  return [
    `M ${r + wob(1)} ${wob(2)}`,
    `L ${w - r + wob(3)} ${wob(4) - 0.5}`,
    `C ${w - r + cp + wob(5)} ${wob(6)} ${w + wob(7)} ${cp + wob(8)} ${w + wob(9) - 0.5} ${r}`,
    `C ${w + wob(10)} ${h - cp + wob(11)} ${w - r + cp + wob(12)} ${h + wob(13)} ${w - r + wob(14)} ${h + wob(15) - 0.5}`,
    `L ${r + wob(16)} ${h + wob(17) - 0.5}`,
    `C ${r - cp + wob(18)} ${h + wob(19)} ${wob(20)} ${h - cp + wob(21)} ${wob(22) + 0.5} ${r}`,
    `C ${wob(23)} ${cp + wob(24)} ${r - cp + wob(25)} ${wob(26)} ${r + wob(27)} ${wob(28) + 0.5}`,
    "Z",
  ].join(" ");
}

function RoughBox({
  className = "",
  strokeWidth = 1.4,
  variant = "rect",
  double = false,
  seed = 1,
}) {
  const ref = useRef(null);
  const [dim, setDim] = useState({ w: 100, h: 40 });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(20, Math.round(rect.width));
      const h = Math.max(20, Math.round(rect.height));
      setDim((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const builder = variant === "pill" ? buildRoughPill : buildRoughRect;
  const path = builder(dim.w, dim.h, seed);

  return (
    <svg
      ref={ref}
      className={`rough-box ${className}`.trim()}
      viewBox={`0 0 ${dim.w} ${dim.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {double ? (
        <path
          d={builder(dim.w, dim.h, seed + 11)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth * 0.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.5"
        />
      ) : null}
    </svg>
  );
}

function HandUnderline({ className = "" }) {
  return (
    <svg
      className={`hand-underline ${className}`}
      viewBox="0 0 268 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={HAND_UNDERLINE}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function PencilButton({
  children,
  className = "",
  variant = "rect",
  type = "button",
  ...rest
}) {
  return (
    <button type={type} className={`pencil-btn ${className}`} {...rest}>
      <RoughBox className="pencil-btn-frame" variant={variant} />
      <span className="pencil-btn-label">{children}</span>
    </button>
  );
}

export default function FeedbackPage() {
  const search = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const from = search.get("from") || "";
  const error = useMemo(() => readStashedError(), []);
  const snapshot = useMemo(() => readSnapshot(), []);
  const diagText = useMemo(
    () => (snapshot ? formatDiagnostics(snapshot) : ""),
    [snapshot],
  );
  const requestedKind = search.get("kind") || "";
  const wantsGeneral = requestedKind === "general" || requestedKind === "say-hi";
  const isIssue = !wantsGeneral && (requestedKind === "error" || Boolean(error));
  const isStory = !wantsGeneral && (requestedKind === "story" || from === "done");
  const isScriptScreen = SCRIPT_SCREENS.has(from);
  const isSayHi = wantsGeneral || (!isIssue && !isStory && !isScriptScreen);
  const showDiagnostics = isIssue && Boolean(error || snapshot);
  const ctx =
    isIssue ?
      {
        title: "Report an app problem",
        lede: "Tell me what broke. Parser corrections are now best sent from the small parser issue button during practice.",
      }
    : isSayHi ?
      pageContext("landing")
    : pageContext(from);
  const noteLabel =
    isIssue ? "What went wrong?"
    : isStory ? "What happened?"
    : "Your note";
  const placeholder =
    isIssue ? "What happened, what you expected, anything that helps..."
    : isStory ? "I used this to learn my lines for..."
    : "Say hi, share an idea, or tell me what felt off...";
  const actions =
    isIssue ? [
      ["error", "Send app report"],
      ["general", showDiagnostics ? "Send without debug" : "Send as note", true],
    ]
    : isStory ? [
      ["story", "Send story"],
      ["general", "Send regular note", true],
    ]
    : isScriptScreen ? [["general", "Send note"]]
    : [["general", "Say hi"]];
  const mascot = isSayHi ? "" : "/mascots/Primary.svg";

  const [note, setNote] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const compose = async (kind) => {
    const includeDiagnostics = kind === "error";
    const email = senderEmail.trim();

    if (!EMAIL_RE.test(email)) {
      setSent(false);
      setSendError("Enter your email before sending.");
      return;
    }

    setSending(kind);
    setSent(false);
    setSendError("");
    try {
      await sendFeedback({
        kind,
        from,
        note,
        senderEmail: email,
        error: includeDiagnostics ? error : null,
        includeDiagnostics,
      });
      if (includeDiagnostics) {
        clearStashedError();
        clearSnapshot();
      }
      setSent(true);
    } catch (err) {
      setSendError(err.message || "Could not send feedback.");
    } finally {
      setSending("");
    }
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(FEEDBACK_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const copyDiag = () => {
    navigator.clipboard?.writeText(diagText);
    setDiagCopied(true);
    setTimeout(() => setDiagCopied(false), 1600);
  };

  return (
    <div className="fb-page">
      <div className="paper-backdrop" aria-hidden="true">
        <span className="paper-margin" />
        <span className="paper-rules" />
      </div>

      <header className="site-chrome practice-chrome">
        <a className="chrome-link chrome-mark squiggle-hover" href="/">
          Your Script
        </a>
        <span className="chrome-center">Feedback</span>
        <div className="chrome-right">
          <a
            className="chrome-link chrome-cta squiggle-hover"
            href={from === "landing" || !from ? "/" : "/upload"}
          >
            Back
            <svg
              className="chrome-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
              style={{ transform: "scaleX(-1)" }}
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </header>

      <main className="fb-main">
        <header className="paper-heading fb-heading">
          <p className="paper-eyebrow">A note to the maker</p>
          <h1>{ctx.title}</h1>
          <HandUnderline className="fb-rule" />
          <p className="fb-lede">{ctx.lede}</p>
        </header>

        <section className="paper-card fb-card-paper">
          <RoughBox className="paper-card-frame fb-card-frame" double />
          <div className="paper-card-body fb-card-body">
            {mascot ? (
              <img className="fb-mascot" src={mascot} alt="" aria-hidden="true" />
            ) : null}

            {showDiagnostics ? (
              <div className="fb-debug">
                <div className="fb-debug-note">
                  <RoughBox className="fb-debug-frame" seed={7} />
                  <p>
                    I will include safe debug details with this report. They
                    show structure only, not your script text. For a specific
                    bad cue or line, use parser issue during practice.
                  </p>
                </div>
                {snapshot ? (
                  <details className="fb-debug-details">
                    <summary>See exactly what's attached</summary>
                    <pre className="fb-debug-pre">{diagText}</pre>
                    <button
                      type="button"
                      className="fb-email fb-debug-copy"
                      onClick={copyDiag}
                    >
                      {diagCopied ? "copied!" : "copy this"}
                    </button>
                  </details>
                ) : null}
              </div>
            ) : null}

            <label className="fb-note-field">
              <span className="fb-note-label">Your email</span>
              <div className="fb-note-wrap fb-email-wrap">
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <RoughBox className="fb-note-frame" seed={4} />
              </div>
            </label>

            <label className="fb-note-field">
              <span className="fb-note-label">{noteLabel}</span>
              <div className="fb-note-wrap">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder={placeholder}
                />
                <RoughBox className="fb-note-frame" seed={5} />
              </div>
            </label>

            <div className="fb-actions">
              {actions.map(([kind, label, secondary]) => (
                <PencilButton
                  key={kind}
                  className={`fb-action ${secondary ? "is-secondary" : ""}`}
                  disabled={Boolean(sending)}
                  onClick={() => compose(kind)}
                >
                  {sending === kind ? "Sending..." : label}
                </PencilButton>
              ))}
            </div>
          </div>
        </section>

        <p className="fb-fallback">
          Email:{" "}
          <button type="button" className="fb-email" onClick={copyEmail}>
            {copied ? "copied!" : FEEDBACK_EMAIL}
          </button>
          {sent ? " · sent" : null}
        </p>

        {sendError ? (
          <div className="practice-toast fb-toast" role="alert">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="toast-icon">
              <circle cx="10" cy="10" r="9" fill="currentColor" />
              <path
                d="M10 5v6M10 14v1"
                stroke="#f2f0e8"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>{sendError}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => setSendError("")}
            >
              ×
            </button>
          </div>
        ) : null}
      </main>

      <div className="grain-layer" aria-hidden="true" />
    </div>
  );
}
