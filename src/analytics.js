// ─── Anonymous event tracking ───────────────────────────────────────────────
// Fire-and-forget pings to the backend, which tallies them per day and emails a
// single daily digest of the 7 named counts to metrics@yourscript.app (via
// Resend's free tier).  No personal data, no script content — just an event
// name.  Never blocks the UI and never throws.
//
// The /api/event endpoint is rate-limit-exempt on the backend, so a busy user's
// metrics are never dropped.  Sending the digest is gated on RESEND_API_KEY; if
// that's unset the backend just logs the digest (handy for local testing).

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// The seven tracked events (kept in sync with the backend's allowlist).
export const EVENTS = {
  SCRIPT_UPLOADED: "script_uploaded",
  SCRIPT_ANALYZED: "script_analyzed",
  CHARACTER_SELECTED: "character_selected",
  PRACTICE_STARTED: "practice_started",
  PRACTICE_COMPLETED: "practice_completed",
  EXPORT_CLICKED: "export_clicked",
  ERROR_OCCURRED: "error_occurred",
};

export function track(event) {
  try {
    fetch(`${API_BASE}/api/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true, // still sent if the page is navigating away
    }).catch(() => {});
  } catch {
    // analytics must never break the app
  }
}
