import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MascotLoader from "./MascotLoader.jsx";
import { stashError } from "../feedback.js";
import { track, EVENTS, sendParserEvent } from "../analytics.js";
import {
  buildSnapshot,
  stashSnapshot,
  fileMeta,
  maskText,
} from "../diagnostics.js";

// API base — dev always uses Vite's /api proxy so local checks hit the local
// backend even when .env contains the production Railway URL.
const API_BASE = (
  import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE || ""
).replace(/\/+$/, "");
const api = (path) => `${API_BASE}${path}`;

// Hand-drawn underline used in headings/section dividers (stays a fixed
// path; it's always rendered at a known aspect ratio).
const HAND_UNDERLINE =
  "M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14";

const DEFAULT_SETTINGS = {
  includeStageDirectionsInCue: false,
  caseSensitive: false,
  punctuation: false,
  timedMode: true,
  includeMusicAsLines: false,
};

const MODES = [
  { id: "active", label: "Active recall" },
  { id: "flashcard", label: "Flashcards" },
];

const SETUP_STEPS = ["Cleanup", "Role", "First line"];

const STATUS_MASCOTS = {
  wrong: "/mascots/Stuck.svg",
  review: "/mascots/Reviewing.svg",
  right: "/mascots/Making Progress.svg",
};

const ANALYZE_CAPTIONS = [
  "Reading the script…",
  "Sorting characters…",
  "Numbering scenes…",
];

const PARSE_CAPTIONS = [
  "Lining up cues…",
  "Cueing your role…",
  "Pulling out lines…",
];

const PARSER_ISSUES = [
  { id: "wrong_speaker", label: "Wrong speaker" },
  { id: "stage_direction", label: "Stage direction" },
  { id: "dialogue", label: "Missed dialogue" },
  { id: "lyric", label: "Song lyric" },
  { id: "music_cue", label: "Music cue" },
  { id: "split_block", label: "Split block" },
  { id: "merge_block", label: "Merged block" },
  { id: "exclude_line", label: "Should exclude" },
];

// Hand-drawn confetti scattered across the cue card on a correct recall.
// Positions are percentages within the card; kind picks the doodle shape,
// delay staggers the pop, rot gives each one a little tilt.
const CORRECT_SPARKS = [
  { kind: "star", x: 16, y: 26, delay: 0, rot: -14 },
  { kind: "dot", x: 33, y: 14, delay: 70, rot: 0 },
  { kind: "plus", x: 50, y: 9, delay: 30, rot: 8 },
  { kind: "star", x: 69, y: 15, delay: 100, rot: 13 },
  { kind: "dot", x: 85, y: 27, delay: 130, rot: 0 },
  { kind: "plus", x: 24, y: 58, delay: 160, rot: -7 },
  { kind: "star", x: 78, y: 56, delay: 120, rot: 11 },
  { kind: "dot", x: 52, y: 68, delay: 190, rot: 0 },
];

// ── helpers ──────────────────────────────────────────────────────────────
function seconds(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function clockTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, "0")}`;
}

function cleanCharacterName(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeLine(value, settings) {
  let text = value || "";
  if (!settings.caseSensitive) text = text.toLowerCase();
  if (!settings.punctuation) {
    text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "");
  }
  return text.trim().replace(/\s+/g, " ");
}

function answerMatches(answer, expected, settings) {
  return normalizeLine(answer, settings).includes(
    normalizeLine(expected, settings),
  );
}

function displayCue(value) {
  return (value || "").replace(/^\*\*(.*)\*\*$/, "$1");
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

// Reads a newline-delimited JSON progress stream from the API. Each
// `progress` event nudges the loader with a real backend checkpoint; the
// final `result` event carries the payload. Falls back to a plain JSON
// read when the server didn't stream (e.g. an up-front validation error),
// so callers can treat both shapes identically.
async function streamApiResponse(response, onProgress) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.body || !contentType.includes("ndjson")) {
    return readApiResponse(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result;
  let lastLabel = "";

  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (event.type === "progress") {
      if (event.label) lastLabel = event.label;
      onProgress?.({
        value: event.value,
        stage: event.stage,
        label: event.label || lastLabel,
      });
    } else if (event.type === "result") {
      result = event.payload;
    } else if (event.type === "error") {
      throw new Error(event.error || "Request failed.");
    } else if (event.ok === false) {
      throw new Error(event.error || "Request failed.");
    } else if (event.ok) {
      result = event;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      consume(line);
    }
  }
  buffer += decoder.decode();
  if (buffer) consume(buffer);

  if (result === undefined) {
    throw new Error("The parser didn't return a result.");
  }
  if (result.ok === false) {
    throw new Error(result.error || "Request failed.");
  }
  return result;
}

function firstWords(text, n) {
  return (text || "").trim().split(/\s+/).slice(0, n).join(" ");
}

function wordCount(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function parserShape(text) {
  const raw = String(text || "");
  const trimmed = raw.trim();
  const bits = [];
  if (!trimmed) bits.push("blank");
  if (/^\s+/.test(raw)) bits.push("indent");
  if (/^[([]/.test(trimmed)) bits.push("bracketed");
  if (/\p{L}/u.test(trimmed) && trimmed === trimmed.toUpperCase()) bits.push("all caps");
  if (/[:.]$/.test(trimmed)) bits.push("ends punctuation");
  return bits.join(", ") || "plain";
}

// Build a hand-drawn rectangle path that adapts to the container's
// actual pixel dimensions.  Wobble amplitudes are deterministic (sin-
// seeded) so the same box always looks the same — no random regen on
// re-render — while still feeling drawn-by-hand.
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
    `Z`,
  ].join(" ");
}

// Reusable pencil-drawn rectangle.  Watches its parent element with a
// ResizeObserver, so the SVG path is regenerated whenever the container
// resizes — the box ALWAYS fits its content, at any aspect ratio,
// without distortion.
function RoughBox({
  className = "",
  strokeWidth = 1.4,
  variant = "rect",
  double = false,
  boil = false,
  seed = 1,
}) {
  const ref = useRef(null);
  const [dim, setDim] = useState({ w: 100, h: 40 });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(20, Math.round(r.width));
      const h = Math.max(20, Math.round(r.height));
      setDim((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const builder = variant === "pill" ? buildRoughPill : buildRoughRect;
  // Boil = the classic hand-animation trick: redraw the same outline a
  // few times and swap between the takes so the line looks alive.  We
  // render three deterministic variants and let CSS cross-cut between
  // them ("always" cycles on its own; "hover" only wakes on parent hover).
  const boilMode = boil === true ? "always" : boil || null;
  const path1 = builder(dim.w, dim.h, seed);
  const path2 = double ? builder(dim.w, dim.h, seed + 11) : null;
  const boilClass =
    boilMode === "always" ? "is-boil"
    : boilMode === "hover" ? "is-boil-hover"
    : "";

  return (
    <svg
      ref={ref}
      className={`rough-box ${className} ${boilClass}`.trim()}
      viewBox={`0 0 ${dim.w} ${dim.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {boilMode ?
        [seed, seed + 7, seed + 15].map((s, i) => (
          <path
            key={s}
            className={`boil-frame boil-frame-${i + 1}`}
            d={builder(dim.w, dim.h, s)}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))
      : <>
          <path
            d={path1}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {path2 ? (
            <path
              d={path2}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth * 0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.5"
            />
          ) : null}
        </>
      }
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

// Hand-drawn checkbox — a pencil-sketched box that gets a marker tick when
// on.  Reads like ticking a box on the notebook page instead of a glossy
// switch.  Seeded off the label so each box wobbles a little differently.
function Toggle({ checked, label, onChange }) {
  const seed = label ? label.length : 1;
  return (
    <label className={`paper-check ${checked ? "is-checked" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="paper-check-box" aria-hidden="true">
        <RoughBox className="paper-check-frame" seed={seed} strokeWidth={1.5} />
        <svg
          className="paper-check-tick"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4.5 13 Q 6.8 15.4 9 17.8 Q 13.4 11 19.5 5.8" />
        </svg>
      </span>
      <span className="paper-check-label">{label}</span>
    </label>
  );
}

function WizardPager({
  step,
  stepCount,
  onBack,
  onNext,
  nextLabel,
  canNext,
  backLabel = "Back",
}) {
  return (
    <nav className="wizard-pager" aria-label="Setup steps">
      <button
        type="button"
        className="pager-link pager-back"
        onClick={onBack}
        disabled={step === 0}
        aria-label="Previous step"
      >
        <span className="pager-chev" aria-hidden="true">
          {"<"}
        </span>
        {backLabel}
      </button>
      <ol className="pager-dots" aria-hidden="true">
        {Array.from({ length: stepCount }, (_, i) => (
          <li
            key={i}
            className={
              i === step ? "is-active"
              : i < step ? "is-done"
              : "is-todo"
            }
          />
        ))}
      </ol>
      <button
        type="button"
        className="pager-link pager-next"
        onClick={onNext}
        disabled={!canNext}
      >
        {nextLabel}
        <span className="pager-chev" aria-hidden="true">
          {">"}
        </span>
      </button>
    </nav>
  );
}

// Single segmented control: outer rough pill holds both labels with a
// vertical pipe between them; the active label gets its own circled
// outline inside, matching the way IMG_3511 sketches the active option.
function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="Practice mode">
      <RoughBox className="mode-toggle-frame" variant="pill" />
      {MODES.map((entry, i) => {
        const active = entry.id === mode;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`mode-seg ${active ? "is-active" : ""}`}
            onClick={() => onChange(entry.id)}
          >
            {active ? (
              <RoughBox
                className="mode-seg-active-frame"
                variant="pill"
              />
            ) : null}
            <span className="mode-seg-label">{entry.label}</span>
            {i === 0 ? (
              <span className="mode-divider" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Compact status card per IMG_3511 — small rough-bordered rectangle
// holding a mascot SVG on the left and the running tally on the right.
// Title (Stuck / Reviewing / Progress) sits underneath the rectangle.
function StatusBadge({ tone, value, label }) {
  // When the tally ticks up, give the card a quick "stamp" — the number
  // pops and the mascot hops.  We detect the rise against the previous
  // render and flag `is-bump` for one animation cycle.
  const prevValue = useRef(value);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (value > prevValue.current) {
      setBump(true);
      const id = window.setTimeout(() => setBump(false), 560);
      prevValue.current = value;
      return () => window.clearTimeout(id);
    }
    prevValue.current = value;
    return undefined;
  }, [value]);

  return (
    <div className={`status-badge tone-${tone} ${bump ? "is-bump" : ""}`}>
      <div className="status-badge-card">
        <RoughBox className="status-badge-frame" />
        <img
          src={STATUS_MASCOTS[tone]}
          alt=""
          className="status-badge-icon"
          aria-hidden="true"
        />
        <strong>{value}</strong>
      </div>
      <span className="status-badge-label">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PracticeApp
// ─────────────────────────────────────────────────────────────────────────
export default function PracticeApp() {
  const fileInputRef = useRef(null);
  const answerRef = useRef(null);
  const [phase, setPhase] = useState("upload");
  const [file, setFile] = useState(null);
  const [scriptText, setScriptText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [targetCharacter, setTargetCharacter] = useState("");
  const [newCharacter, setNewCharacter] = useState("");
  const [bodyStartLine, setBodyStartLine] = useState(1);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [parsed, setParsed] = useState(null);
  const [practiceItems, setPracticeItems] = useState([]);
  const [roundLabel, setRoundLabel] = useState("Full run");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0, review: 0 });
  const [missed, setMissed] = useState([]);
  const [busy, setBusy] = useState("");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadCaption, setLoadCaption] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [lineStartedAt, setLineStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Cleanup wizard step state (split out from the legacy single textarea)
  const [cleanupKeep, setCleanupKeep] = useState(true);
  const [cleanupArtifacts, setCleanupArtifacts] = useState([]);
  const [newArtifact, setNewArtifact] = useState("");

  // Setup wizard + practice state
  const [setupStep, setSetupStep] = useState(0);
  const [mode, setMode] = useState("active");
  const [hintShown, setHintShown] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parserIssues, setParserIssues] = useState([]);
  const [parserIssueStatus, setParserIssueStatus] = useState("idle");
  const [parserIssueError, setParserIssueError] = useState("");
  const [parserIssueSentCount, setParserIssueSentCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "practice" || !settings.timedMode) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase, settings.timedMode]);

  useEffect(() => {
    if (phase !== "practice" || mode !== "active") return;
    answerRef.current?.focus();
  }, [phase, mode, currentIndex]);

  useEffect(() => {
    setHintShown(false);
    setRevealed(false);
  }, [currentIndex, mode]);

  const currentItem = practiceItems[currentIndex] || null;
  const completed = stats.right + stats.wrong;
  const accuracy = completed ? Math.round((stats.right / completed) * 100) : 0;
  const sessionElapsed = sessionStartedAt ? now - sessionStartedAt : 0;
  const lineElapsed = lineStartedAt && !feedback ? now - lineStartedAt : 0;
  const progressFrac =
    practiceItems.length ?
      (currentIndex + (feedback ? 1 : 0)) / practiceItems.length
    : 0;

  // Cleanup phrases get serialized to a newline-joined string before being
  // sent to the backend — the API has always expected `cleanup` as a string.
  const cleanupString = useMemo(
    () => (cleanupKeep ? cleanupArtifacts.join("\n") : ""),
    [cleanupKeep, cleanupArtifacts],
  );

  const setupReady = useMemo(
    () => Boolean(analysis && targetCharacter.trim()),
    [analysis, targetCharacter],
  );

  const canStepForward =
    setupStep === 0 ? !cleanupKeep || cleanupArtifacts.length >= 0
    : setupStep === 1 ? Boolean(targetCharacter.trim())
    : setupStep === 2 ? Number(bodyStartLine) >= 1
    : false;

  const loaderActive = busy === "analyze" || busy === "parse";
  const loaderMascot =
    busy === "analyze" ?
      "/mascots/Sorting Cues.svg"
    : busy === "parse" ?
      "/mascots/Listening for Cue.svg"
    : "/mascots/writing.svg";
  const loaderCaptions =
    busy === "analyze" ? ANALYZE_CAPTIONS
    : busy === "parse" ? PARSE_CAPTIONS
    : ANALYZE_CAPTIONS;

  // ── handlers ───────────────────────────────────────────────────────────
  function chooseFile(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    setScriptText("");
    setAnalysis(null);
    setParsed(null);
    setPhase("upload");
    setError("");
  }

  // Stream callback for the loader. Forward-only so a late/duplicate
  // checkpoint can never visually rewind the bar, and the caption follows
  // whatever real stage the backend last named.
  function handleLoadProgress({ value, label }) {
    if (typeof value === "number") {
      setLoadProgress((prev) => (value > prev ? value : prev));
    }
    if (label) setLoadCaption(label);
  }

  async function analyzeScript(event) {
    event.preventDefault();
    if (!file && !scriptText.trim()) {
      setError("Choose a .txt or .pdf script, or paste script text.");
      return;
    }

    setBusy("analyze");
    setLoadProgress(0);
    setLoadCaption("Reading your script");
    setError("");
    track(EVENTS.SCRIPT_UPLOADED);
    try {
      let response;
      if (file) {
        const form = new FormData();
        form.append("script", file);
        // Cleanup is gathered in the wizard, after analyze — we still send
        // whatever the user has so far in case it helps body detection.
        form.append("cleanup", cleanupString);
        response = await fetch(api("/api/analyze"), { method: "POST", body: form });
      } else {
        response = await fetch(api("/api/analyze-text"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scriptText,
            fileName: "Pasted Script.txt",
            cleanup: cleanupString,
          }),
        });
      }
      const payload = await streamApiResponse(response, handleLoadProgress);
      setLoadProgress(1);
      const detected = payload.characters || [];
      setAnalysis(payload);
      setCharacters(detected);
      setTargetCharacter(detected[0] || "");
      setBodyStartLine((payload.bodyStartIndex || 0) + 1);
      setSetupStep(0);
      setPhase("setup");
      track(EVENTS.SCRIPT_ANALYZED);
    } catch (requestError) {
      setError(requestError.message);
      stashError({
        message: requestError.message,
        context: file ? "analyze (file upload)" : "analyze (pasted text)",
        input: fileMeta(file, scriptText),
      });
      track(EVENTS.ERROR_OCCURRED);
    } finally {
      setBusy("");
    }
  }

  async function parseScript() {
    if (!setupReady) {
      setError("Choose your role before starting.");
      return;
    }

    setBusy("parse");
    setLoadProgress(0);
    setLoadCaption("Building your run");
    setError("");
    try {
      const response = await fetch(api("/api/parse"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: analysis.scriptId,
          cleanup: cleanupString,
          targetCharacter,
          bodyStartIndex: Math.max(0, Number(bodyStartLine || 1) - 1),
          characters,
          settings,
        }),
      });
      const payload = await streamApiResponse(response, handleLoadProgress);
      setLoadProgress(1);
      setParsed(payload);
      // Stash an IP-safe diagnostic snapshot of the run (masked structure only,
      // no script text) so a feedback report can carry real debug detail.
      try {
        stashSnapshot(
          buildSnapshot({
            parsed: payload,
            analysis,
            targetCharacter,
            characters,
            file,
            scriptText,
            cleanup: cleanupString,
            settings,
          }),
        );
      } catch {
        // diagnostics must never block a successful parse
      }
      startRound(payload.items || [], "Full run");
    } catch (requestError) {
      setError(requestError.message);
      stashError({
        message: requestError.message,
        context: `parse (role ${maskText(targetCharacter, 24) || "?"})`,
        input: fileMeta(file, scriptText),
      });
      track(EVENTS.ERROR_OCCURRED);
    } finally {
      setBusy("");
    }
  }

  function reportParserIssue({ kind, note, item, index }) {
    if (!item) return null;

    const issue = {
      kind,
      noteMask: maskText(note, 500),
      parserVersion: "web-client",
      context: {
        screen: phase,
        mode,
        round: roundLabel,
        line: index + 1,
      },
      settings,
      parseRun: {
        input: fileMeta(file, scriptText),
        sourceLines: parsed?.lineCount || analysis?.lineCount || 0,
        practiceLines: parsed?.total || practiceItems.length,
        turns: parsed?.turnCount || 0,
        bodyStartLine: (parsed?.bodyStartIndex ?? analysis?.bodyStartIndex ?? 0) + 1,
      },
      block: {
        index: index + 1,
        characterMask: maskText(item.character || targetCharacter, 24, {
          compact: true,
        }),
        cueMask: maskText(item.cue, 120),
        lineMask: maskText(item.line, 120),
        cueW: wordCount(item.cue),
        lineW: wordCount(item.line),
      },
      before: {
        classification: "practice_pair",
        speaker: maskText(item.character || targetCharacter, 24, { compact: true }),
      },
      after: {
        correctionKind: kind,
      },
      formatting: {
        shape: `cue ${parserShape(item.cue)}; line ${parserShape(item.line)}`,
      },
    };

    setParserIssues((current) => [...current, issue]);
    setParserIssueStatus("queued");
    setParserIssueError("");
    return { queued: true };
  }

  async function sendParserIssues(issues = parserIssues) {
    if (!issues.length) {
      setParserIssueStatus("idle");
      return;
    }

    setParserIssueStatus("sending");
    setParserIssueError("");

    const results = await Promise.allSettled(
      issues.map((issue) => sendParserEvent(issue)),
    );
    const failedIssues = issues.filter(
      (_, index) => results[index].status === "rejected",
    );
    const sentCount = issues.length - failedIssues.length;

    if (failedIssues.length) {
      setParserIssues(failedIssues);
      setParserIssueSentCount(sentCount);
      setParserIssueStatus("error");
      setParserIssueError(
        `Couldn't send ${failedIssues.length} parser note${failedIssues.length === 1 ? "" : "s"}.`,
      );
      track(EVENTS.ERROR_OCCURRED);
      return;
    }

    setParserIssues([]);
    setParserIssueSentCount(issues.length);
    setParserIssueStatus("sent");
  }

  function startRound(items, label) {
    setPracticeItems(items);
    setRoundLabel(label);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setStats({ right: 0, wrong: 0, review: 0 });
    setMissed([]);
    setHistory([]);
    setParserIssues([]);
    setParserIssueStatus("idle");
    setParserIssueError("");
    setParserIssueSentCount(0);
    setSessionStartedAt(Date.now());
    setLineStartedAt(Date.now());
    setNow(Date.now());
    if (items.length) track(EVENTS.PRACTICE_STARTED);
    setPhase(items.length ? "practice" : "done");
  }

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function addCharacter() {
    const cleaned = cleanCharacterName(newCharacter);
    if (!cleaned || characters.includes(cleaned)) {
      setNewCharacter("");
      return;
    }
    setCharacters((current) => [...current, cleaned].sort());
    setTargetCharacter(cleaned);
    setNewCharacter("");
  }

  function removeCharacter(character) {
    const next = characters.filter((item) => item !== character);
    setCharacters(next);
    if (targetCharacter === character) setTargetCharacter(next[0] || "");
  }

  function addArtifact() {
    const trimmed = newArtifact.trim();
    if (!trimmed || cleanupArtifacts.includes(trimmed)) {
      setNewArtifact("");
      return;
    }
    setCleanupArtifacts((current) => [...current, trimmed]);
    setNewArtifact("");
  }

  function removeArtifact(artifact) {
    setCleanupArtifacts((current) => current.filter((a) => a !== artifact));
  }

  function recordItem(status) {
    if (!currentItem) return;
    const lineTimeMs = Date.now() - lineStartedAt;
    setHistory((current) => [
      ...current,
      { item: currentItem, status, mode, lineTimeMs },
    ]);
  }

  // Grading rules:
  //   - Fail (wrong typed answer or revealed answer) → always Wrong, even
  //     if the hint was used.
  //   - Got it right + hint used → Review (you needed help).
  //   - Got it right + no hint → Right.
  function gradeCurrent(status) {
    if (!currentItem || feedback) return;
    const lineTimeMs = Date.now() - lineStartedAt;
    const correct =
      status === "submit" &&
      answerMatches(answer, currentItem.line, settings);

    if (correct) {
      if (hintShown) {
        setStats((s) => ({ ...s, review: s.review + 1 }));
        setMissed((m) => [...m, currentItem]);
        setFeedback({
          status: "review",
          message: "Got it with a hint",
          expected: currentItem.line,
          lineTimeMs,
        });
        recordItem("review");
        return;
      }
      setStats((s) => ({ ...s, right: s.right + 1 }));
      setFeedback({
        status: "correct",
        message: "Correct",
        expected: currentItem.line,
        lineTimeMs,
      });
      recordItem("right");
      return;
    }

    setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    setMissed((m) => [...m, currentItem]);
    setFeedback({
      status: "wrong",
      message: status === "reveal" ? "Revealed" : "Wrong",
      expected: currentItem.line,
      lineTimeMs,
    });
    recordItem("wrong");
  }

  // Flashcard self-grade: Got it / Review / Stuck.  Review marks the
  // line for another look; hint usage on a correct answer also lands
  // it in the review pile.  Stuck always counts as Wrong.
  function selfGrade(status) {
    if (!currentItem || feedback) return;
    const lineTimeMs = Date.now() - lineStartedAt;
    if (status === "right") {
      if (hintShown) {
        setStats((s) => ({ ...s, review: s.review + 1 }));
        setMissed((m) => [...m, currentItem]);
        setFeedback({
          status: "review",
          message: "Got it with a hint",
          expected: currentItem.line,
          lineTimeMs,
        });
        recordItem("review");
        return;
      }
      setStats((s) => ({ ...s, right: s.right + 1 }));
      setFeedback({
        status: "correct",
        message: "Got it",
        expected: currentItem.line,
        lineTimeMs,
      });
      recordItem("right");
      return;
    }
    if (status === "review") {
      setStats((s) => ({ ...s, review: s.review + 1 }));
      setMissed((m) => [...m, currentItem]);
      setFeedback({
        status: "review",
        message: "Marked for review",
        expected: currentItem.line,
        lineTimeMs,
      });
      recordItem("review");
      return;
    }
    setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    setMissed((m) => [...m, currentItem]);
    setFeedback({
      status: "wrong",
      message: "Stuck",
      expected: currentItem.line,
      lineTimeMs,
    });
    recordItem("wrong");
  }

  function endSession() {
    track(EVENTS.PRACTICE_COMPLETED);
    setPhase("done");
    sendParserIssues(parserIssues);
  }

  function nextCue() {
    if (currentIndex + 1 >= practiceItems.length) {
      endSession();
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setFeedback(null);
    setLineStartedAt(Date.now());
    setNow(Date.now());
  }

  function prevCue() {
    if (currentIndex === 0) return;
    setCurrentIndex((index) => index - 1);
    setAnswer("");
    setFeedback(null);
    setLineStartedAt(Date.now());
    setNow(Date.now());
  }

  function retryMissed() {
    startRound(missed, "Missed lines");
  }

  function resetToSetup() {
    setPhase("setup");
    setPracticeItems([]);
    setAnswer("");
    setFeedback(null);
    setStats({ right: 0, wrong: 0, review: 0 });
    setMissed([]);
    setHistory([]);
    setParserIssues([]);
    setParserIssueStatus("idle");
    setParserIssueError("");
    setParserIssueSentCount(0);
  }

  // Download the user's cue/line list as a .txt — handy to print or study away
  // from the screen.  (Built from the current run; nothing leaves the browser.)
  function exportLines() {
    track(EVENTS.EXPORT_CLICKED);
    const items = parsed?.items || practiceItems || [];
    if (!items.length) return;
    const who = (targetCharacter || "MY LINES").toUpperCase();
    const base = (analysis?.fileName || "your-script").replace(/\.[^.]+$/, "");
    const body = items
      .map(
        (it, i) =>
          `${i + 1}.\n  cue · ${displayCue(it.cue)}\n  ${who} · ${it.line}`,
      )
      .join("\n\n");
    const blob = new Blob([`${base} — ${who}\n\n${body}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base} — ${who} lines.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleNextStep() {
    if (setupStep === 1) track(EVENTS.CHARACTER_SELECTED);
    if (setupStep < SETUP_STEPS.length - 1) {
      setSetupStep((s) => s + 1);
      return;
    }
    parseScript();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  // Settings only apply during the wizard setup — once practice has
  // started, the settings are locked in for the session.
  const showSettingsButton = phase === "setup";

  return (
    <main className="practice-page is-paper">
      <PaperBackdrop />

      <header className="site-chrome practice-chrome">
        <a className="chrome-link chrome-mark squiggle-hover" href="/">
          Your Script
        </a>
        <span className="chrome-center">
          <PhaseCrumbs
            phase={phase}
            setupStep={setupStep}
            stepCount={SETUP_STEPS.length}
            roundLabel={roundLabel}
          />
        </span>
        <div className="chrome-right">
          {showSettingsButton ? (
            <button
              type="button"
              className="chrome-icon-btn"
              aria-label="Open settings"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsGlyph />
            </button>
          ) : null}
          {(() => {
            // Once a script is in play (setup / quiz / review), the "back"
            // CTA returns to the upload page to start a new script — only the
            // upload screen itself links all the way out to landing.
            const inSession = phase !== "upload";
            return (
              <a
                className="chrome-link chrome-cta squiggle-hover"
                href={inSession ? "/upload" : "/"}
              >
                {inSession ? "New script" : "Landing"}
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
            );
          })()}
        </div>
      </header>

      {error ? (
        <div className="practice-toast" role="alert">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="toast-icon">
            <circle cx="10" cy="10" r="9" fill="currentColor" />
            <path
              d="M10 5v6M10 14v1"
              stroke="#f2f0e8"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>{error}</span>
          <a
            className="toast-report"
            href={`/feedback?from=${encodeURIComponent(phase)}&kind=error`}
          >
            report this&nbsp;→
          </a>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      ) : null}

      <section
        className={`practice-shell on-paper ${
          phase === "practice" ? "is-rehearsal" : ""
        }`}
      >
        {phase === "upload" ? (
          <UploadStage
            file={file}
            dragging={dragging}
            scriptText={scriptText}
            busy={busy}
            fileInputRef={fileInputRef}
            onChoose={chooseFile}
            onPaste={setScriptText}
            clearFile={() => setFile(null)}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
            onSubmit={analyzeScript}
          />
        ) : null}

        {phase === "setup" ? (
          <SetupWizard
            step={setupStep}
            cleanupKeep={cleanupKeep}
            setCleanupKeep={setCleanupKeep}
            cleanupArtifacts={cleanupArtifacts}
            removeArtifact={removeArtifact}
            newArtifact={newArtifact}
            setNewArtifact={setNewArtifact}
            addArtifact={addArtifact}
            characters={characters}
            targetCharacter={targetCharacter}
            setTargetCharacter={setTargetCharacter}
            removeCharacter={removeCharacter}
            newCharacter={newCharacter}
            setNewCharacter={setNewCharacter}
            addCharacter={addCharacter}
            analysis={analysis}
            bodyStartLine={bodyStartLine}
            setBodyStartLine={setBodyStartLine}
            onBack={() => setSetupStep((s) => Math.max(0, s - 1))}
            onNext={handleNextStep}
            canNext={canStepForward && !loaderActive}
            busy={busy}
          />
        ) : null}

        {phase === "practice" && currentItem ? (
          <PracticeRoom
            currentItem={currentItem}
            currentIndex={currentIndex}
            total={practiceItems.length}
            mode={mode}
            onModeChange={setMode}
            stats={stats}
            reviewCount={stats.review}
            answer={answer}
            onAnswer={setAnswer}
            answerRef={answerRef}
            feedback={feedback}
            settings={settings}
            lineElapsed={lineElapsed}
            sessionElapsed={sessionElapsed}
            progressFrac={progressFrac}
            hintShown={hintShown}
            onHint={() => setHintShown(true)}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            targetCharacter={targetCharacter}
            onCheck={() => gradeCurrent("submit")}
            onRevealAnswer={() => gradeCurrent("reveal")}
            onSelfGrade={selfGrade}
            onNext={nextCue}
            onPrev={prevCue}
            isFirst={currentIndex === 0}
            isLast={currentIndex + 1 >= practiceItems.length}
            onReportIssue={reportParserIssue}
            parserIssueCount={parserIssues.length}
            onEndSession={endSession}
          />
        ) : null}

        {phase === "done" ? (
          <DoneSession
            history={history}
            stats={stats}
            accuracy={accuracy}
            settings={settings}
            sessionElapsed={sessionElapsed}
            roundLabel={roundLabel}
            parsedTotal={parsed?.total || 0}
            hasMissed={missed.length > 0}
            onRetryAll={() => startRound(parsed?.items || [], "Full run")}
            onRetryMissed={retryMissed}
            onBackToSetup={resetToSetup}
            onExport={exportLines}
            parserIssueCount={parserIssues.length}
            parserIssueStatus={parserIssueStatus}
            parserIssueError={parserIssueError}
            parserIssueSentCount={parserIssueSentCount}
            onRetryParserIssues={() => sendParserIssues(parserIssues)}
          />
        ) : null}
      </section>

      <SettingsModal
        open={settingsOpen && phase !== "upload"}
        settings={settings}
        onChange={updateSetting}
        onClose={() => setSettingsOpen(false)}
      />

      <MascotLoader
        phase={loaderActive ? "open" : "idle"}
        mascot={loaderMascot}
        captions={loaderCaptions}
        label={busy === "parse" ? "Building your run" : "Reading your script"}
        progress={loaderActive ? loadProgress : null}
        caption={loadCaption}
        note={busy === "parse" ? "This might take a while" : ""}
      />

      <div className="grain-layer" aria-hidden="true" />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components — kept in this file because they're each used once and
// the indirection of separate files would just add noise.
// ─────────────────────────────────────────────────────────────────────────

function PaperBackdrop() {
  return (
    <div className="paper-backdrop" aria-hidden="true">
      <span className="paper-margin" />
      <span className="paper-rules" />
    </div>
  );
}

function PaperHeading({ eyebrow, title, subtitle }) {
  return (
    <header className="paper-heading">
      {eyebrow ? <p className="paper-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <HandUnderline className="paper-heading-rule" />
      {subtitle ? <p className="paper-subtitle">{subtitle}</p> : null}
    </header>
  );
}

function PhaseCrumbs({ phase, setupStep, stepCount, roundLabel }) {
  if (phase === "upload") return <>Line rehearsal</>;
  if (phase === "setup") {
    return (
      <span className="phase-crumbs">
        <em>Setup</em>
        <span className="phase-crumbs-dots" aria-hidden="true">
          {Array.from({ length: stepCount }, (_, i) => (
            <i
              key={i}
              className={
                i === setupStep ? "is-active"
                : i < setupStep ? "is-done"
                : ""
              }
            />
          ))}
        </span>
      </span>
    );
  }
  if (phase === "practice") return <>{roundLabel}</>;
  if (phase === "done") return <>Review session</>;
  return null;
}

function SettingsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-glyph">
      {/* Proper gear/cog with 8 teeth */}
      <path
        d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2l1.4 2.6 2.9-.3.6 2.9 2.5 1.5-1.1 2.7 1.1 2.7-2.5 1.5-.6 2.9-2.9-.3L12 22l-1.4-2.6-2.9.3-.6-2.9L4.6 15.3l1.1-2.7-1.1-2.7 2.5-1.5.6-2.9 2.9.3L12 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Upload stage ────────────────────────────────────────────────────────
function UploadStage({
  file,
  dragging,
  scriptText,
  busy,
  fileInputRef,
  onChoose,
  onPaste,
  clearFile,
  onDragStart,
  onDragEnd,
  onSubmit,
}) {
  const [showPaste, setShowPaste] = useState(false);
  const hasInput = Boolean(file) || scriptText.trim().length > 0;

  return (
    <div className="paper-stage upload-stage-paper">
      <header className="upload-heading">
        <p className="paper-eyebrow">Line rehearsal</p>
        <h1 className="upload-title">Upload a script</h1>
        <p className="upload-lede">
          Drop in your script — we'll pull every cue for your part.
        </p>
      </header>

      <form className="upload-form" onSubmit={onSubmit}>
        <div className="upload-row">
          <img
            src="/mascots/Primary.svg"
            alt=""
            aria-hidden="true"
            className="upload-mascot"
          />
          <button
            type="button"
            className={`paper-dropzone ${dragging ? "is-dragging" : ""} ${file ? "is-loaded" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              onDragStart();
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragEnd}
            onDrop={(event) => {
              event.preventDefault();
              onDragEnd();
              onChoose(event.dataTransfer.files?.[0]);
            }}
          >
            <RoughBox className="paper-dropzone-frame" strokeWidth={1.3} double />
            <span className="paper-dropzone-inner">
              {file ? (
                <span className="paper-dropzone-text">{file.name}</span>
              ) : (
                <>
                  <svg
                    className="paper-dropzone-arrow"
                    viewBox="0 0 40 40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 Q 20.6 15 20 23" />
                    <path d="M13 16.5 Q 20 25 27 16.5" />
                    <path d="M9 31 Q 20 33.4 31 31" />
                  </svg>
                  <span className="paper-dropzone-text">Drop it here</span>
                  <span className="paper-dropzone-hint">.pdf or .txt</span>
                </>
              )}
            </span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          hidden
          onChange={(event) => onChoose(event.target.files?.[0])}
        />

        <div className="upload-secondary">
          {!showPaste && !scriptText ? (
            <button
              type="button"
              className="upload-text-link"
              onClick={() => setShowPaste(true)}
            >
              or paste script text
            </button>
          ) : (
            <div className="upload-textarea-wrap upload-paste-wrap">
              <textarea
                id="script-text"
                value={scriptText}
                onChange={(event) => {
                  onPaste(event.target.value);
                  if (event.target.value.trim()) clearFile();
                }}
                placeholder={
                  "JULIET: O Romeo, Romeo! wherefore art thou Romeo?\n" +
                  "Deny thy father and refuse thy name;\n" +
                  "Or, if thou wilt not, be but sworn my love,\n" +
                  "And I'll no longer be a Capulet."
                }
                rows={5}
              />
              <RoughBox className="upload-textarea-frame" />
            </div>
          )}
        </div>

        {hasInput ? (
          <div className="upload-actions">
            <PencilButton
              type="submit"
              className="upload-submit"
              disabled={busy === "analyze"}
            >
              {busy === "analyze" ?
                "Parsing…"
              : <>
                  Parse script
                  <span aria-hidden="true">{" ›"}</span>
                </>
              }
            </PencilButton>
          </div>
        ) : null}
      </form>
    </div>
  );
}

// ── Setup wizard ────────────────────────────────────────────────────────
function SetupWizard({
  step,
  cleanupKeep,
  setCleanupKeep,
  cleanupArtifacts,
  removeArtifact,
  newArtifact,
  setNewArtifact,
  addArtifact,
  characters,
  targetCharacter,
  setTargetCharacter,
  removeCharacter,
  newCharacter,
  setNewCharacter,
  addCharacter,
  analysis,
  bodyStartLine,
  setBodyStartLine,
  onBack,
  onNext,
  canNext,
  busy,
}) {
  // Each step gets its own characterful title + a warm, plain-language
  // prompt — no more three identical "Preferences" headings.
  const titles = ["Tidy up", "Your role", "Curtain up"];
  const subtitles = [
    "Clear out any repeating headers or page numbers.",
    "Which part are you running?",
    "Where does your scene begin?",
  ];

  return (
    <div className="paper-stage paper-stage-setup">
      <PaperHeading
        eyebrow={`Step ${step + 1} of ${SETUP_STEPS.length}`}
        title={titles[step]}
        subtitle={subtitles[step]}
      />

      <div className="setup-wizard">
        <div key={step} className={`wizard-step step-${step}`}>
          {step === 0 ? (
            <CleanupStep
              cleanupKeep={cleanupKeep}
              setCleanupKeep={setCleanupKeep}
              cleanupArtifacts={cleanupArtifacts}
              removeArtifact={removeArtifact}
              newArtifact={newArtifact}
              setNewArtifact={setNewArtifact}
              addArtifact={addArtifact}
            />
          ) : null}
          {step === 1 ? (
            <RoleStep
              characters={characters}
              targetCharacter={targetCharacter}
              onPick={setTargetCharacter}
              onRemove={removeCharacter}
              newCharacter={newCharacter}
              onNewCharacter={setNewCharacter}
              onAdd={addCharacter}
            />
          ) : null}
          {step === 2 ? (
            <FirstLineStep
              analysis={analysis}
              bodyStartLine={bodyStartLine}
              setBodyStartLine={setBodyStartLine}
            />
          ) : null}
        </div>
      </div>

      <WizardPager
        step={step}
        stepCount={SETUP_STEPS.length}
        onBack={onBack}
        onNext={onNext}
        nextLabel={
          step === SETUP_STEPS.length - 1 ?
            busy === "parse" ? "Building…" : "Start"
          : "Next"
        }
        canNext={canNext}
      />
    </div>
  );
}

function CleanupStep({
  cleanupKeep,
  setCleanupKeep,
  cleanupArtifacts,
  removeArtifact,
  newArtifact,
  setNewArtifact,
  addArtifact,
}) {
  return (
    <div className="paper-card paper-card-cleanup">
      <RoughBox className="paper-card-frame" double />
      <div className="paper-card-body">
        <div className="yesno-row" role="radiogroup" aria-label="Remove repeated headers">
          <button
            type="button"
            role="radio"
            aria-checked={cleanupKeep === true}
            className={`yesno-btn ${cleanupKeep ? "is-active" : ""}`}
            onClick={() => setCleanupKeep(true)}
          >
            <RoughBox className="yesno-frame" />
            <span>Yes</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={cleanupKeep === false}
            className={`yesno-btn ${!cleanupKeep ? "is-active" : ""}`}
            onClick={() => setCleanupKeep(false)}
          >
            <RoughBox className="yesno-frame" />
            <span>No</span>
          </button>
        </div>

        {cleanupKeep ? (
          <div className="artifact-block">
            <p className="artifact-helper">
              Each line you add gets stripped from the script.
            </p>
            {cleanupArtifacts.length ? (
              <ul className="artifact-list">
                {cleanupArtifacts.map((artifact) => (
                  <li key={artifact}>
                    <span>{artifact}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${artifact}`}
                      onClick={() => removeArtifact(artifact)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="artifact-add">
              <label className="artifact-add-field">
                <input
                  type="text"
                  value={newArtifact}
                  onChange={(event) => setNewArtifact(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addArtifact();
                  }}
                  placeholder="Add artifact"
                />
                <RoughBox className="artifact-add-frame" />
              </label>
              <PencilButton
                className="artifact-add-btn"
                variant="pill"
                onClick={addArtifact}
                aria-label="Add artifact"
              >
                +
              </PencilButton>
            </div>
          </div>
        ) : (
          <p className="artifact-helper artifact-helper-muted">
            We'll keep the script as-is.
          </p>
        )}
      </div>
    </div>
  );
}

function RoleStep({
  characters,
  targetCharacter,
  onPick,
  onRemove,
  newCharacter,
  onNewCharacter,
  onAdd,
}) {
  return (
    <div className="paper-card paper-card-roles">
      <RoughBox className="paper-card-frame" double />
      <div className="paper-card-body">
        {characters.length ? (
          <ul className="role-list">
            {characters.map((character) => {
              const active = character === targetCharacter;
              return (
                <li
                  key={character}
                  className={`role-chip ${active ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    className="role-chip-name"
                    onClick={() => onPick(character)}
                  >
                    <RoughBox className="role-chip-frame" variant="pill" />
                    <span>{character}</span>
                  </button>
                  <button
                    type="button"
                    className="role-chip-remove"
                    aria-label={`Remove ${character}`}
                    onClick={() => onRemove(character)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="role-empty">No roles were detected.</p>
        )}

        <div className="role-add">
          <label className="role-add-field">
            <input
              type="text"
              value={newCharacter}
              onChange={(event) => onNewCharacter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onAdd();
              }}
              placeholder="Add role"
            />
            <RoughBox className="role-add-frame" />
          </label>
          <PencilButton
            className="role-add-btn"
            variant="pill"
            onClick={onAdd}
            aria-label="Add role"
          >
            +
          </PencilButton>
        </div>
      </div>
    </div>
  );
}

// Per IMG_3508 — no card wrapper, just numbered lines on the paper with
// a wavy hand-drawn underline beneath each.  Clicking a line sets it as
// the start; the picked line gets a heavier underline.
function FirstLineStep({ analysis, bodyStartLine, setBodyStartLine }) {
  const preview = analysis?.preview || [];
  return (
    <ol className="line-pick-list" aria-label="Choose first script line">
      {preview.map((line) => {
        const picked = Number(bodyStartLine) - 1 === line.index;
        return (
          <li key={line.index} className={`line-pick ${picked ? "is-picked" : ""}`}>
            <button
              type="button"
              onClick={() => setBodyStartLine(line.lineNumber)}
            >
              <span className="line-pick-no">{line.lineNumber}.</span>
              <span className="line-pick-body">
                <span className="line-pick-text">{line.text}</span>
                <HandUnderline className="line-pick-rule" />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// Self-grade button — small horizontal card matching IMG_3511's
// "mark correct / mark for review / mark wrong" stack on the right side.
function SelfGradeBtn({ tone, label, onClick }) {
  return (
    <button
      type="button"
      className={`grade-btn tone-${tone}`}
      onClick={onClick}
    >
      <RoughBox className="grade-btn-frame" boil="hover" />
      <img
        src={STATUS_MASCOTS[tone]}
        alt=""
        aria-hidden="true"
        className="grade-btn-icon"
      />
      <span className="grade-btn-label">{label}</span>
    </button>
  );
}

// ── Practice room ───────────────────────────────────────────────────────
// Proper grid layout per IMG_3511–3516:
//   row 1: status cluster (left)     ·     mode toggle (right)
//   row 2: paper card                 ·     right rail (hint, self-grade)
//   row 3: <go back | progress · mascot rider | Confirm/Move on>
function PracticeRoom({
  currentItem,
  currentIndex,
  total,
  mode,
  onModeChange,
  stats,
  reviewCount,
  answer,
  onAnswer,
  answerRef,
  feedback,
  settings,
  lineElapsed,
  sessionElapsed,
  progressFrac,
  hintShown,
  onHint,
  revealed,
  onReveal,
  targetCharacter,
  onCheck,
  onSelfGrade,
  onNext,
  onPrev,
  isFirst,
  isLast,
  onReportIssue,
  parserIssueCount,
  onEndSession,
}) {
  const expected = currentItem.line;
  const character = currentItem.character || targetCharacter;
  const hint = hintShown ? firstWords(expected, 4) + "…" : null;
  const isWrong = feedback?.status === "wrong";
  const isReviewing = feedback?.status === "review";
  const isCorrect = feedback?.status === "correct" || isReviewing;
  const [reportOpen, setReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState(PARSER_ISSUES[0].id);
  const [reportNote, setReportNote] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    setReportOpen(false);
    setReportNote("");
    setReportStatus("");
    setReportBusy(false);
    setConfirmEnd(false);
  }, [currentIndex]);

  // Fit-to-box: rather than scroll (or clip) a long line, shrink the
  // display type until the card body's content fits its available
  // height.  Driven by a CSS custom prop the stage type multiplies in.
  const stageBodyRef = useRef(null);
  useLayoutEffect(() => {
    const body = stageBodyRef.current;
    if (!body) return undefined;
    let raf = 0;
    const fit = () => {
      body.style.setProperty("--stage-scale", "1");
      let scale = 1;
      let guard = 0;
      while (
        body.scrollHeight > body.clientHeight + 1 &&
        scale > 0.5 &&
        guard < 24
      ) {
        scale -= 0.06;
        body.style.setProperty("--stage-scale", String(scale));
        guard += 1;
      }
    };
    raf = requestAnimationFrame(fit);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    observer.observe(body);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [currentIndex, mode, revealed, feedback, expected]);

  // Flashcard mode: clicking the card flips between cue and your-line.
  const cardClickable = mode === "flashcard" && !feedback;
  const cardHandleClick = cardClickable ? onReveal : undefined;

  // Self-grade rail appears after the user has seen their line and now
  // needs to mark how it went (flashcard mode only — active recall has
  // already graded automatically).
  const showSelfGrade =
    mode === "flashcard" && revealed && !feedback;

  async function submitParserReport(event) {
    event.preventDefault();
    if (!onReportIssue || reportBusy) return;

    setReportBusy(true);
    setReportStatus("");
    try {
      await onReportIssue({
        kind: reportKind,
        note: reportNote,
        item: currentItem,
        index: currentIndex,
      });
      setReportStatus("Saved for end of session.");
      setReportNote("");
      setReportOpen(false);
    } catch (error) {
      setReportStatus(error.message || "Could not save that report.");
    } finally {
      setReportBusy(false);
    }
  }

  function handleEndSession() {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    onEndSession();
  }

  // Show the bottom action button differently based on context.
  let primaryAction = null;
  if (mode === "active" && !feedback) {
    primaryAction = (
      <PencilButton onClick={onCheck} className="action-confirm">
        Confirm response
      </PencilButton>
    );
  } else if (feedback || (mode === "flashcard" && revealed)) {
    primaryAction = (
      <PencilButton
        onClick={onNext}
        disabled={mode === "flashcard" && !feedback}
        className="action-next"
      >
        {isLast ? "Review session" : "Move on"}
        <span aria-hidden="true">{" ›"}</span>
      </PencilButton>
    );
  }

  return (
    <div className="rehearsal-room">
      <header className="rehearsal-top">
        <div className="status-cluster">
          <StatusBadge tone="wrong" value={stats.wrong} label="Stuck" />
          <StatusBadge tone="review" value={reviewCount} label="Reviewing" />
          <StatusBadge tone="right" value={stats.right} label="Progress" />
        </div>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </header>

      <div className="rehearsal-stage">
        <article
          className={`paper-card paper-stage-card ${cardClickable ? "is-clickable" : ""}`}
          onClick={cardHandleClick}
          role={cardClickable ? "button" : undefined}
          tabIndex={cardClickable ? 0 : undefined}
          onKeyDown={
            cardClickable ?
              (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onReveal();
                }
              }
            : undefined
          }
        >
          <RoughBox className="paper-card-frame" boil strokeWidth={1.6} />
          <div
            ref={stageBodyRef}
            className={`paper-card-body stage-body ${isWrong ? "is-wrong" : ""}`}
            key={`${currentIndex}-${mode === "flashcard" ? (revealed ? "line" : "cue") : "active"}`}
          >
            {mode === "flashcard" && !isWrong && !isCorrect ? (
              // Single-section flashcard view: either the cue OR the
              // user's line, never both at once.  Flips on click.
              <div className="stage-row stage-single">
                <p className="stage-label">
                  {revealed ? "Your line" : "Cue line"}
                </p>
                <p className="stage-line">
                  {revealed ? expected : displayCue(currentItem.cue)}
                </p>
                {revealed ? (
                  <p className="stage-character">[ {character} ]</p>
                ) : (
                  <span className="stage-hint-text">Click to reveal your line</span>
                )}
              </div>
            ) : (
              // Two-section view for active recall + all feedback states.
              <>
                <div className="stage-row stage-cue">
                  {isWrong ? (
                    <p className="wrong-headline">You were wrong</p>
                  ) : (
                    <>
                      <p className="stage-label">Cue line</p>
                      <p className="stage-line">
                        {displayCue(currentItem.cue)}
                      </p>
                    </>
                  )}
                </div>

                <div className="stage-divider" aria-hidden="true">
                  <HandUnderline />
                </div>

                <div className="stage-row stage-your">
                  <p className="stage-label">
                    {isWrong ?
                      "The correct line was"
                    : isCorrect ?
                      "Your line"
                    : "Your line"}
                  </p>
                  {isWrong ? (
                    <p className="stage-line revealed">{expected}</p>
                  ) : null}
                  {!isWrong && mode === "active" ? (
                    <div className="answer-field">
                      <textarea
                        ref={answerRef}
                        value={answer}
                        onChange={(event) => onAnswer(event.target.value)}
                        disabled={Boolean(feedback)}
                        placeholder="What's your response?"
                        rows={3}
                      />
                      <RoughBox className="answer-field-frame" />
                    </div>
                  ) : null}
                  <p className="stage-character">[ {character} ]</p>
                </div>
              </>
            )}

            {isCorrect ? (
              <div
                className={`stage-feedback ${isReviewing ? "is-review" : "is-correct"}`}
              >
                <span className="stage-feedback-tag">
                  {feedback.message}
                  {settings.timedMode ?
                    ` · ${seconds(feedback.lineTimeMs)}`
                  : ""}
                </span>
              </div>
            ) : null}
          </div>

          {/* Celebratory doodle burst on a correct recall.  Rendered as a
              sibling of .stage-body (never inside it) so it can't change the
              measured scrollHeight that drives the fit-to-card shrink, and
              pointer-events:none so it never eats clicks. Keyed on the line
              so it re-pops for each new correct answer. */}
          {isCorrect && !isReviewing ? (
            <div className="correct-burst" aria-hidden="true" key={currentIndex}>
              {CORRECT_SPARKS.map((s, i) => (
                <span
                  key={i}
                  className={`spark spark-${s.kind}`}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    "--spark-delay": `${s.delay}ms`,
                    "--spark-rot": `${s.rot}deg`,
                  }}
                />
              ))}
            </div>
          ) : null}
        </article>

        <aside className="rehearsal-aside">
          {mode === "active" ? (
            <button
              type="button"
              className={`hint-card ${hintShown ? "is-shown" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onHint();
              }}
              disabled={hintShown || Boolean(feedback)}
            >
              <RoughBox className="hint-card-frame" boil="hover" />
              <img
                src="/mascots/Hint.svg"
                alt=""
                aria-hidden="true"
                className="hint-card-icon"
              />
              <div className="hint-card-text">
                <strong>Hint?</strong>
                <span>{hintShown ? hint : "First few words"}</span>
              </div>
            </button>
          ) : (
            // Flashcard mode: hint is replaced with a direct "mark for
            // review" button — sends this line to the review pile and
            // advances without needing to reveal first.
            <button
              type="button"
              className="hint-card flashcard-review-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelfGrade("review");
              }}
              disabled={Boolean(feedback)}
            >
              <RoughBox className="hint-card-frame" boil="hover" />
              <img
                src="/mascots/Reviewing.svg"
                alt=""
                aria-hidden="true"
                className="hint-card-icon"
              />
              <div className="hint-card-text">
                <strong>Mark for review</strong>
                <span>save for later</span>
              </div>
            </button>
          )}

          {showSelfGrade ? (
            <div className="self-grade-stack">
              <SelfGradeBtn
                tone="right"
                label="got it"
                onClick={() => onSelfGrade("right")}
              />
              <SelfGradeBtn
                tone="wrong"
                label="stuck"
                onClick={() => onSelfGrade("stuck")}
              />
            </div>
          ) : null}

          <div className="parser-report">
            {!reportOpen ? (
              <>
                <button
                  type="button"
                  className="parser-report-link"
                  onClick={() => setReportOpen(true)}
                >
                  {parserIssueCount ?
                    `parser issues (${parserIssueCount})`
                  : "parser issue?"}
                </button>
                {reportStatus ? (
                  <p className="parser-report-status">{reportStatus}</p>
                ) : null}
              </>
            ) : (
              <form className="parser-report-panel" onSubmit={submitParserReport}>
                <RoughBox className="parser-report-frame" />
                <label>
                  <span>What went wrong?</span>
                  <select
                    value={reportKind}
                    onChange={(event) => setReportKind(event.target.value)}
                  >
                    {PARSER_ISSUES.map((issue) => (
                      <option key={issue.id} value={issue.id}>
                        {issue.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Optional note</span>
                  <textarea
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    rows={2}
                    placeholder="What should it have done?"
                  />
                </label>
                <div className="parser-report-actions">
                  <button type="submit" disabled={reportBusy}>
                    {reportBusy ? "saving..." : "save for end"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportOpen(false);
                      setReportStatus("");
                    }}
                  >
                    cancel
                  </button>
                </div>
                {reportStatus ? (
                  <p className="parser-report-status">{reportStatus}</p>
                ) : null}
              </form>
            )}
          </div>
        </aside>
      </div>

      <footer className="rehearsal-foot">
        <button
          type="button"
          className="foot-link foot-back"
          onClick={onPrev}
          disabled={isFirst}
        >
          <span aria-hidden="true">{"‹"}</span> go back
        </button>

        <div className="foot-progress">
          <div className="foot-progress-rail" aria-hidden="true">
            <svg
              viewBox="0 0 520 28"
              preserveAspectRatio="none"
              className="foot-progress-rail-outline"
            >
              <path
                d="M 4 6 Q 130 4 260 6 T 516 5 L 516 23 Q 390 25 260 23 T 4 24 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 130 13 L 130 19"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 260 12 L 260 20"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 390 13 L 390 19"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              className="foot-progress-fill"
              style={{ width: `${Math.min(1, progressFrac) * 100}%` }}
            />
            <img
              src="/mascots/Writing Something Great.svg"
              alt=""
              aria-hidden="true"
              className="foot-progress-mascot"
              style={{
                left: `calc(${Math.max(0.02, Math.min(0.96, progressFrac)) * 100}% - 50px)`,
              }}
            />
          </div>
          {settings.timedMode ? (
            <span className="foot-progress-meta">
              <em>{clockTime(lineElapsed)}</em>
              <i aria-hidden="true">·</i>
              <span>{clockTime(sessionElapsed)}</span>
              <i aria-hidden="true">·</i>
              <span>
                {currentIndex + 1}/{total}
              </span>
            </span>
          ) : (
            <span className="foot-progress-meta">
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>

        <div className="foot-actions">
          <button
            type="button"
            className={`foot-link foot-end ${confirmEnd ? "is-confirming" : ""}`}
            onClick={handleEndSession}
          >
            {confirmEnd ? "yes, end" : "end session"}
          </button>
          {confirmEnd ? (
            <button
              type="button"
              className="foot-link foot-cancel"
              onClick={() => setConfirmEnd(false)}
            >
              cancel
            </button>
          ) : null}
          {primaryAction}
        </div>
      </footer>
    </div>
  );
}

// ── Done / review session ───────────────────────────────────────────────
function DoneSession({
  history,
  stats,
  accuracy,
  settings,
  sessionElapsed,
  roundLabel,
  parsedTotal,
  hasMissed,
  onRetryAll,
  onRetryMissed,
  onBackToSetup,
  onExport,
  parserIssueCount,
  parserIssueStatus,
  parserIssueError,
  parserIssueSentCount,
  onRetryParserIssues,
}) {
  return (
    <div className="paper-stage">
      <PaperHeading
        eyebrow={roundLabel}
        title={parsedTotal ? "Review session" : "No lines found"}
        subtitle={
          parsedTotal ?
            `${stats.right} right · ${stats.review} review · ${stats.wrong} stuck · ${accuracy}% accuracy${settings.timedMode ? ` · ${clockTime(sessionElapsed)} total` : ""}`
          : "Try another role or move the first script line."
        }
      />

      <div className="review-summary">
        <StatusBadge tone="wrong" value={stats.wrong} label="Stuck" />
        <StatusBadge tone="review" value={stats.review} label="In review" />
        <StatusBadge tone="right" value={stats.right} label="Right" />
      </div>

      {history.length ? (
        <ol className="review-list">
          {history.map((entry, idx) => {
            const tone = toneFor(entry.status);
            return (
              <li key={idx} className={`review-row tone-${tone}`}>
                <RoughBox className="review-row-frame" />
                <img
                  src={STATUS_MASCOTS[tone]}
                  alt=""
                  aria-hidden="true"
                  className="review-row-icon"
                />
                <div className="review-row-body">
                  <p className="review-row-head">
                    <strong>{idx + 1}.</strong>
                    <span className="review-row-mode">
                      {entry.mode === "flashcard" ? "Flashcard" : "Active recall"}
                    </span>
                    <span className={`review-row-tag tone-${tone}`}>
                      {labelFor(entry.status)}
                    </span>
                    {settings.timedMode ? (
                      <span className="review-row-time">
                        {seconds(entry.lineTimeMs)}
                      </span>
                    ) : null}
                  </p>
                  <p className="review-row-line">{entry.item.line}</p>
                  <p className="review-row-cue">
                    cue · {displayCue(entry.item.cue)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="review-empty">No lines to review yet.</p>
      )}

      <ParserIssueSync
        count={parserIssueCount}
        status={parserIssueStatus}
        error={parserIssueError}
        sentCount={parserIssueSentCount}
        onRetry={onRetryParserIssues}
      />

      <div className="review-actions">
        {parsedTotal ? (
          <PencilButton onClick={onExport}>Download lines</PencilButton>
        ) : null}
        {parsedTotal ? (
          <PencilButton onClick={onRetryAll}>Try again</PencilButton>
        ) : null}
        {hasMissed ? (
          <PencilButton onClick={onRetryMissed}>Retry missed</PencilButton>
        ) : null}
        <PencilButton onClick={onBackToSetup}>
          {parsedTotal ? "Complete session" : "Back to settings"}
        </PencilButton>
      </div>

      {parsedTotal ? (
        <p className="review-aside">
          Did this help you learn your lines?{" "}
          <a className="review-aside-link" href="/feedback?from=done&kind=story">
            Tell the maker&nbsp;→
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ParserIssueSync({ count, status, error, sentCount, onRetry }) {
  if (status === "idle" || (!count && status !== "sent")) return null;

  const message =
    status === "sending" ? `Sending ${count} parser note${count === 1 ? "" : "s"}...`
    : status === "sent" ? `Sent ${sentCount} parser note${sentCount === 1 ? "" : "s"}.`
    : status === "error" ?
      `${sentCount ? `Sent ${sentCount}. ` : ""}${error || "Parser notes could not be sent."}`
    : `${count} parser note${count === 1 ? "" : "s"} saved for this session.`;

  return (
    <div className={`review-parser-sync is-${status}`}>
      <RoughBox className="review-parser-sync-frame" />
      <span>{message}</span>
      {status === "error" ? (
        <button type="button" onClick={onRetry}>
          try again
        </button>
      ) : null}
    </div>
  );
}

function toneFor(status) {
  if (status === "right") return "right";
  if (status === "wrong") return "wrong";
  return "review";
}

function labelFor(status) {
  if (status === "right") return "right";
  if (status === "wrong") return "stuck";
  return "review";
}

// ── Settings modal ──────────────────────────────────────────────────────
function SettingsModal({ open, settings, onChange, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="settings-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-label="Settings"
    >
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <RoughBox className="settings-modal-frame" strokeWidth={1.4} double />
        <div className="settings-modal-body">
          <header className="settings-modal-head">
            <h2>Settings</h2>
            <HandUnderline className="settings-modal-rule" />
            <button
              type="button"
              className="settings-modal-close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <ol className="settings-list settings-list-modal">
            <li>
              <Toggle
                label="Stage directions in cue"
                checked={settings.includeStageDirectionsInCue}
                onChange={(value) =>
                  onChange("includeStageDirectionsInCue", value)
                }
              />
            </li>
            <li>
              <Toggle
                label="Case sensitive"
                checked={settings.caseSensitive}
                onChange={(value) => onChange("caseSensitive", value)}
              />
            </li>
            <li>
              <Toggle
                label="Keep punctuation"
                checked={settings.punctuation}
                onChange={(value) => onChange("punctuation", value)}
              />
            </li>
            <li>
              <Toggle
                label="Timed mode"
                checked={settings.timedMode}
                onChange={(value) => onChange("timedMode", value)}
              />
            </li>
            <li>
              <Toggle
                label="Include music as dialogue"
                checked={settings.includeMusicAsLines}
                onChange={(value) => onChange("includeMusicAsLines", value)}
              />
            </li>
          </ol>

          <div className="settings-modal-actions">
            <PencilButton onClick={onClose}>Confirm selection</PencilButton>
          </div>
        </div>
      </div>
    </div>
  );
}
