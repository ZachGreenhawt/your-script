// ─── IP-safe parser diagnostics ─────────────────────────────────────────────
// When someone reports a parser problem, the maker needs to see WHAT broke —
// but the script is copyrighted, so we must never transmit its text.
//
// The trick: parser bugs are almost always about *structure*, not words —
// capitalization, punctuation, where speaker tags sit, line lengths, how lines
// were attributed.  So we send a structure-preserving MASK:
//
//     "ROMEO.  But soft, what light?"  →  "XXXXX.  Xxx xxxx, xxxx xxxxx?"
//
// Every letter becomes X/x (by case), every digit 9; spacing, punctuation and
// markup are kept verbatim.  That tells the maker exactly how the parser saw a
// line — and the original copyrighted text is unrecoverable from it.  Alongside
// the masks we send only counts, positions, and file metadata (type/size).

const SNAP_KEY = "yourscript:lastRun";
const MAX_LINES = 30; // cap the stored snapshot so it never balloons
const MAX_SOURCE_LINES = 36;
const FIELD_CAP = 90; // per-field mask length

// Replace every letter with X/x (by case) and every digit with 9, across
// scripts, keeping punctuation and line spacing. Use compact:true for fields
// like speaker names where extra whitespace is not meaningful.
export function maskText(value, cap = FIELD_CAP, { compact = false } = {}) {
  if (value == null) return "";
  const raw = String(value).replace(/\r\n?/g, "\n");
  const str = compact ? raw.replace(/\s+/g, " ").trim() : raw.replace(/\n/g, " ↵ ");
  const clipped = str.slice(0, cap);
  const masked = clipped
    .replace(/\p{L}/gu, (ch) => (/\p{Lu}/u.test(ch) ? "X" : "x"))
    .replace(/\p{N}/gu, "9");
  return str.length > cap ? `${masked}…` : masked;
}

const wordCount = (s) => {
  const t = String(s || "").trim();
  return t ? t.split(/\s+/).length : 0;
};

// File metadata that can't identify the work: type, extension, rough size.
// (We deliberately never send the filename — a title isn't ours to leak.)
export function fileMeta(file, scriptText = "") {
  if (file) {
    const ext = (file.name?.split(".").pop() || "").toLowerCase().slice(0, 8);
    const type = file.type || "";
    const kind =
      type.includes("pdf") || ext === "pdf"
        ? "pdf"
        : type.startsWith("image/") ||
            ["png", "jpg", "jpeg", "tiff", "tif", "webp"].includes(ext)
          ? "image (OCR)"
          : "text file";
    return { kind, ext: ext || "?", sizeKB: Math.max(1, Math.round(file.size / 1024)) };
  }
  return {
    kind: "pasted text",
    ext: "txt",
    sizeKB: Math.max(1, Math.round((scriptText?.length || 0) / 1024)),
  };
}

function itemShape(item, i, flagged) {
  const cue = item?.cue || "";
  const line = item?.line || "";
  return {
    i: i + 1,
    flag: flagged,
    cueMask: maskText(cue),
    lineMask: maskText(line),
    cueW: wordCount(cue),
    lineW: wordCount(line),
  };
}

function lineShape(value) {
  const raw = String(value || "");
  const text = raw.trim();
  const bits = [];
  const indent = raw.match(/^\s*/)?.[0].length || 0;

  if (!text) bits.push("blank");
  if (indent) bits.push(`indent ${indent}`);
  if (/^[([]/.test(text)) bits.push("bracketed");
  if (/\p{L}/u.test(text) && text === text.toUpperCase()) bits.push("all caps");
  if (/[:.]$/.test(text)) bits.push("ends punctuation");

  return bits.join(", ") || "plain";
}

function sourceShape(line, selectedStart) {
  const index = Number.isInteger(line?.index)
    ? line.index
    : Number(line?.lineNumber || 1) - 1;
  const text = line?.text || "";
  return {
    n: line?.lineNumber || index + 1,
    start: index === selectedStart,
    suggested: Boolean(line?.suggested),
    shape: lineShape(text),
    mask: maskText(text, 120),
    words: wordCount(text),
  };
}

function sourceWindow(preview = [], selectedStart = 0) {
  if (!Array.isArray(preview) || !preview.length) return [];

  const startIndex = Math.max(0, selectedStart);
  const near = preview.filter((line) => {
    const index = Number.isInteger(line?.index)
      ? line.index
      : Number(line?.lineNumber || 1) - 1;
    return index >= startIndex - 8 && index <= startIndex + 28;
  });
  const lines = near.length ? near : preview;

  return lines.slice(0, MAX_SOURCE_LINES).map((line) =>
    sourceShape(line, startIndex),
  );
}

function cleanupMasks(cleanup) {
  return String(cleanup || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => maskText(line, 80, { compact: true }));
}

// Build the full IP-safe snapshot from a successful parse.
export function buildSnapshot(ctx = {}) {
  const {
    parsed,
    analysis,
    targetCharacter,
    characters = [],
    file,
    scriptText,
    cleanup = "",
    settings = {},
    flagged = [],
  } = ctx;
  const items = parsed?.items || [];
  const chars = characters.length ? characters : analysis?.characters || [];
  const flaggedSet = new Set(flagged);
  const selectedStart = Number.isInteger(parsed?.bodyStartIndex)
    ? parsed.bodyStartIndex
    : analysis?.bodyStartIndex || 0;

  const all = items.map((it, i) => itemShape(it, i, flaggedSet.has(i)));
  // Keep flagged lines first so they survive the cap, then re-sort by position.
  const kept = [...all]
    .sort((a, b) => Number(b.flag) - Number(a.flag) || a.i - b.i)
    .slice(0, MAX_LINES)
    .sort((a, b) => a.i - b.i);

  const n = Math.max(1, items.length);
  const sumCue = items.reduce((t, it) => t + String(it.cue || "").length, 0);
  const sumLine = items.reduce((t, it) => t + String(it.line || "").length, 0);

  return {
    at: new Date().toISOString(),
    input: fileMeta(file, scriptText),
    speakers: {
      count: chars.length,
      masks: chars.slice(0, 12).map((c) => maskText(c, 24, { compact: true })),
    },
    role: {
      index: Math.max(0, chars.indexOf(parsed?.targetCharacter || targetCharacter)) + 1,
      of: chars.length,
      mask: maskText(parsed?.targetCharacter || targetCharacter, 24, { compact: true }),
      lines: items.length,
    },
    bodyStartLine: selectedStart + 1,
    suggestedBodyStartLine: (analysis?.bodyStartIndex || 0) + 1,
    source: sourceWindow(analysis?.preview, selectedStart),
    cleanup: cleanupMasks(cleanup),
    settings: {
      stageDirectionsInCue: Boolean(settings.includeStageDirectionsInCue),
      caseSensitive: Boolean(settings.caseSensitive),
      punctuation: Boolean(settings.punctuation),
      timedMode: Boolean(settings.timedMode),
    },
    stats: {
      total: parsed?.total ?? items.length,
      sourceLines: parsed?.lineCount ?? analysis?.lineCount ?? 0,
      turns: parsed?.turnCount ?? 0,
      avgCueChars: Math.round(sumCue / n),
      avgLineChars: Math.round(sumLine / n),
      emptyCues: items.filter((it) => !String(it.cue || "").trim()).length,
      emptyLines: items.filter((it) => !String(it.line || "").trim()).length,
    },
    flaggedCount: all.filter((l) => l.flag).length,
    lines: kept,
  };
}

// Render a snapshot (or a bare error) into a plain-text block for the email
// body / on-page preview.  `maxLines` bounds the masked-line dump.
export function formatDiagnostics(
  snap,
  { maxLines = Infinity, maxSourceLines = Infinity } = {},
) {
  if (!snap) return "";
  const L = ["— diagnostic snapshot (IP-safe: masked structure only, no script text) —"];

  if (snap.input) L.push(`input:    ${snap.input.kind} · ~${snap.input.sizeKB} KB`);
  if (snap.speakers)
    L.push(
      `speakers: ${snap.speakers.count} detected` +
        (snap.speakers.masks?.length ? ` — ${snap.speakers.masks.join(", ")}` : ""),
    );
  if (snap.role)
    L.push(
      `role:     #${snap.role.index} of ${snap.role.of} (${snap.role.mask}) · ${snap.role.lines} lines`,
    );
  if (snap.bodyStartLine) {
    const suggested =
      snap.suggestedBodyStartLine && snap.suggestedBodyStartLine !== snap.bodyStartLine
        ? ` (analyzer suggested ${snap.suggestedBodyStartLine})`
        : "";
    L.push(`body:     began at line ${snap.bodyStartLine}${suggested}`);
  }
  if (snap.settings)
    L.push(
      `settings: stage dirs in cue ${snap.settings.stageDirectionsInCue ? "on" : "off"} · case ${snap.settings.caseSensitive ? "on" : "off"} · punctuation ${snap.settings.punctuation ? "on" : "off"}`,
    );
  if (snap.cleanup?.length)
    L.push(`removed:  ${snap.cleanup.length} masked cleanup line(s) — ${snap.cleanup.join(" | ")}`);
  if (snap.stats)
    L.push(
      `parsed:   ${snap.stats.total} practice line(s) from ${snap.stats.sourceLines || "?"} source line(s) · ${snap.stats.turns || 0} turn(s) · avg cue ${snap.stats.avgCueChars}c · avg line ${snap.stats.avgLineChars}c · empty cues ${snap.stats.emptyCues} · empty lines ${snap.stats.emptyLines}`,
    );
  if (snap.flaggedCount)
    L.push(`flagged:  ${snap.flaggedCount} line(s) marked as parser slips (*)`);

  if (snap.source?.length) {
    L.push("");
    L.push("source preview near selected start (masked logical script lines):");
    L.push("  * = selected start, ~ = analyzer suggested start");
    const shown = snap.source.slice(0, maxSourceLines);
    for (const ln of shown) {
      const marks = `${ln.start ? "*" : " "}${ln.suggested ? "~" : " "}`;
      L.push(
        `${String(ln.n).padStart(3)}${marks} [${ln.shape}; ${ln.words}w] "${ln.mask}"`,
      );
    }
    if (snap.source.length > shown.length)
      L.push(`     … ${snap.source.length - shown.length} more source line(s) masked on the feedback page`);
  }

  if (snap.lines?.length) {
    L.push("");
    L.push("practice pairs produced by parser (masked cue → your line):");
    const shown = snap.lines.slice(0, maxLines);
    for (const ln of shown) {
      const tag = `${String(ln.i).padStart(3)}${ln.flag ? "*" : " "}`;
      L.push(`${tag} cue  "${ln.cueMask}" (${ln.cueW}w)`);
      L.push(`     line "${ln.lineMask}" (${ln.lineW}w)`);
    }
    if (snap.lines.length > shown.length)
      L.push(`     … ${snap.lines.length - shown.length} more line(s) — see the full copy on the feedback page`);
  }
  return L.join("\n");
}

// ── sessionStorage stash (ephemeral, client-only — never persisted) ─────────
export function stashSnapshot(snap) {
  try {
    sessionStorage.setItem(SNAP_KEY, JSON.stringify(snap));
  } catch {
    // non-fatal
  }
}

export function readSnapshot() {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSnapshot() {
  try {
    sessionStorage.removeItem(SNAP_KEY);
  } catch {
    // ignore
  }
}
