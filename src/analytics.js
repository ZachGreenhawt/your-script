// ─── Anonymous event tracking ───────────────────────────────────────────────
// Fire-and-forget pings to the backend, which tallies them per day and emails a
// single daily digest of the named counts to metrics@yourscript.app (via
// Resend's free tier).  No personal data, no script content - just an event
// name.  Never blocks the UI and never throws.
//
// The /api/event endpoint is rate-limit-exempt on the backend, so a busy user's
// metrics are never dropped.  Sending the digest is gated on RESEND_API_KEY; if
// that's unset the backend just logs the digest (handy for local testing).

const API_BASE = (
  import.meta.env.DEV ?
    ""
  : import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// Tracked events kept in sync with the backend allowlist.
export const EVENTS = {
  SCRIPT_UPLOADED: "script_uploaded",
  SCRIPT_ANALYZED: "script_analyzed",
  CHARACTER_SELECTED: "character_selected",
  PRACTICE_STARTED: "practice_started",
  PRACTICE_COMPLETED: "practice_completed",
  REHEARSAL_SECONDS: "rehearsal_seconds",
  EXPORT_CLICKED: "export_clicked",
  ERROR_OCCURRED: "error_occurred",
  PARSER_CORRECTION: "parser_correction",
};

export function track(event, amount) {
  try {
    const body = { event };
    if (Number.isFinite(amount) && amount > 0) body.amount = amount;
    fetch(`${API_BASE}/api/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // still sent if the page is navigating away
    }).catch(() => {});
  } catch {
    // analytics must never break the app
  }
}

export function trackPageView(path, title) {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    const pagePath =
      path ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: title || document.title,
    });
  } catch {
    // Google Analytics must never break the app
  }
}

export async function sendParserEvent(correction) {
  const response = await fetch(`${API_BASE}/api/parser-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correction }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Could not save parser feedback.");
  }
  return payload;
}

// Sends every parser issue flagged during a session as one batched report at
// session end. The backend emails a single masked summary (and still records
// each issue in the daily metrics). `keepalive` lets it complete even if the
// session-end click also navigates away.
export async function sendParserReport(issues) {
  const list = Array.isArray(issues) ? issues : [];
  if (!list.length) return { ok: true, recorded: 0 };

  const response = await fetch(`${API_BASE}/api/parser-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issues: list }),
    keepalive: true,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Could not send the parser report.");
  }
  return payload;
}
