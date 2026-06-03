// ─── Feedback plumbing ──────────────────────────────────────────────────────
// Everything funnels to one inbox.  We use a mailto: composer so it works with
// zero backend infra and reliably reaches the inbox; the /feedback page and the
// footer both build on these helpers.  (When the backend is ready, the same
// payloads can POST to an /api/feedback endpoint — see buildPayload.)

import { readSnapshot, formatDiagnostics } from "./diagnostics.js";

export const EMAILS = {
  metrics: "metrics@yourscript.app", // auto daily digest (sent by the backend)
  impact: "impact@yourscript.app", // success stories + general feedback
  debug: "debug@yourscript.app", // bug / parser-issue reports
};

// Which inbox a given feedback kind routes to.
export function emailFor(kind) {
  return kind === "error" ? EMAILS.debug : EMAILS.impact;
}

// Shown as the human contact on the feedback page.
export const FEEDBACK_EMAIL = EMAILS.impact;

// Playful, page-specific footer prompts.
const PROMPTS = {
  landing: "Built by a student. Spotted a bug, or have a story to share?",
  upload: "Parser flubbed a line? Tell me exactly what it missed.",
  setup: "Roles or the start line looking off? Let me know.",
  practice: "How's the run going? Got a note?",
  done: "Did this help you land the part? I'd love to hear about it.",
  dashboard: "Bugs, ideas, or a win to share? I'm listening.",
};

export function pagePrompt(page) {
  return (
    PROMPTS[page] || "Feedback, a bug, or a success story? Send it my way."
  );
}

// Contextual heading + lede for the /feedback page, by where the user came from.
const CONTEXT = {
  upload: {
    title: "What went wrong?",
    lede: "If the parser misread your script, tell me what it got wrong — that's exactly how I make it better.",
  },
  setup: {
    title: "Something off?",
    lede: "Wrong characters, a bad start line, cues that don't line up? Let me know what you saw.",
  },
  done: {
    title: "How'd the run go?",
    lede: "Did Your Script help you learn your lines — or land the part? Stories like yours are the whole point.",
  },
  practice: {
    title: "A note mid-run?",
    lede: "Spotted a wrong cue or just want to say something? I read every message.",
  },
  dashboard: {
    title: "Say something",
    lede: "Bugs, ideas, or a win — it all comes straight to me.",
  },
  landing: {
    title: "Say hi",
    lede: "I'm a student building this. A quick note, bug report, or success story genuinely helps.",
  },
};

export function pageContext(from) {
  return (
    CONTEXT[from] || {
      title: "Say something",
      lede: "Feedback, a bug report, or a success story — it all comes straight to me.",
    }
  );
}

// ── Error stash (so an error report can carry real debug info) ──────────────
const ERR_KEY = "yourscript:lastError";

export function stashError(info) {
  try {
    sessionStorage.setItem(
      ERR_KEY,
      JSON.stringify({
        ...info,
        at: new Date().toISOString(),
        url: typeof location !== "undefined" ? location.href : "",
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    );
  } catch {
    // sessionStorage unavailable — non-fatal
  }
}

export function readStashedError() {
  try {
    const raw = sessionStorage.getItem(ERR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStashedError() {
  try {
    sessionStorage.removeItem(ERR_KEY);
  } catch {
    // ignore
  }
}

// A structured object — handy if/when we POST to a backend collector later.
export function buildPayload({
  kind = "general",
  from = "",
  note = "",
  error = null,
}) {
  return {
    kind,
    from,
    note,
    error: kind === "error" ? error || readStashedError() : null,
    at: new Date().toISOString(),
    url: typeof location !== "undefined" ? location.href : "",
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

// Compose a mailto: URL with a subject + body tailored to the intent.
export function buildMailto({
  kind = "general",
  from = "",
  note = "",
  error = null,
  includeDiagnostics = false,
}) {
  let subject;
  let lines;

  if (kind === "error") {
    const e = error || readStashedError() || {};
    subject = "[Your Script] Parser issue";
    lines = [
      "Something didn't parse right. Details below to help you fix it:",
      "",
      "What went wrong (in your words):",
      note || "",
      "",
      "— debug info —",
      `message: ${e.message || "(none)"}`,
      `where:   ${e.context || from || "(unknown)"}`,
      `input:   ${
        e.input ?
          `${e.input.kind} · ~${e.input.sizeKB} KB`
        : e.fileName || "(n/a)"
      }`,
      `time:    ${e.at || new Date().toISOString()}`,
      `url:     ${e.url || (typeof location !== "undefined" ? location.href : "")}`,
      `browser: ${e.ua || (typeof navigator !== "undefined" ? navigator.userAgent : "")}`,
    ];
  } else if (kind === "story") {
    subject = "[Your Script] A success story";
    lines = [
      "Sharing a win with Your Script — thank you, this genuinely means a lot.",
      "",
      "What were you rehearsing (show / role)?",
      "",
      "Did Your Script help? How?",
      "",
      "May I share this (anonymously) as a testimonial?   yes / no",
      "",
      note || "",
    ];
  } else {
    subject = "[Your Script] Feedback";
    lines = ["Your note:", note || "", ""];
  }

  const snapshot = includeDiagnostics ? readSnapshot() : null;
  if (snapshot) lines.push("", formatDiagnostics(snapshot, { maxLines: 10, maxSourceLines: 14 }));

  if (from) lines.push("", `— sent from the ${from} screen`);
  const body = lines.join("\n");
  return `mailto:${emailFor(kind)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
