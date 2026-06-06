// ─── Feedback plumbing ──────────────────────────────────────────────────────
// Everything funnels to the backend, which sends the actual email through
// Resend. No mail client required.

import { readSnapshot, formatDiagnostics } from "./diagnostics.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export const EMAILS = {
  metrics: "metrics@yourscript.app", // auto daily digest (sent by the backend)
  impact: "impact@yourscript.app", // success stories + general feedback
  debug: "debug@yourscript.app", // app problem reports
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
  upload: "Upload acting weird? Tell me what happened.",
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
    title: "Something off?",
    lede: "If upload or parsing went sideways, tell me what you saw. Specific bad cues can be marked from practice.",
  },
  setup: {
    title: "Something off?",
    lede: "Wrong characters, a bad start line, or a confusing setup step? Let me know what you saw.",
  },
  done: {
    title: "How'd the run go?",
    lede: "Did Your Script help you learn your lines — or land the part? Stories like yours are the whole point.",
  },
  practice: {
    title: "A note mid-run?",
    lede: "For a specific parser slip, use the parser issue button. For anything else, I read every message.",
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
  senderEmail = "",
  error = null,
  includeDiagnostics = false,
}) {
  const snapshot = includeDiagnostics ? readSnapshot() : null;
  return {
    kind,
    from,
    note,
    senderEmail,
    error: kind === "error" ? error || readStashedError() : null,
    diagnostics: snapshot
      ? formatDiagnostics(snapshot, { maxLines: 10, maxSourceLines: 14 })
      : "",
    at: new Date().toISOString(),
    url: typeof location !== "undefined" ? location.href : "",
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

export async function sendFeedback({
  kind = "general",
  from = "",
  note = "",
  senderEmail = "",
  error = null,
  includeDiagnostics = false,
}) {
  const response = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildPayload({
        kind,
        from,
        note,
        senderEmail,
        error,
        includeDiagnostics,
      }),
    ),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Could not send feedback.");
  }
  return payload;
}
