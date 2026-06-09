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

function ga(event, params = {}) {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", event, {
      app_name: "your_script",
      ...params,
    });
  } catch {
    // Google Analytics must never break the app
  }
}

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

// GA tracks product behavior and funnel context. The backend email metrics stay
// the source of truth for headline impact totals like uploads, completed
// practice sessions, rehearsal time, exports, and parser reports.
export const GA_EVENTS = {
  ctaStartClick(source) {
    ga("cta_start_click", { source });
  },

  uploadInputSelected(inputMethod, fileType = "") {
    ga("upload_input_selected", { input_method: inputMethod, file_type: fileType });
  },

  analyzeFailed(inputMethod, errorType) {
    ga("analyze_failed", { input_method: inputMethod, error_type: errorType });
  },

  setupStarted(detectedCount) {
    ga("setup_started", { detected_character_count: detectedCount });
  },

  cleanupChoiceChanged(enabled) {
    ga("cleanup_choice_changed", { enabled });
  },

  cleanupRuleAdded(ruleCount) {
    ga("cleanup_rule_added", { cleanup_rule_count: ruleCount });
  },

  cleanupRuleRemoved(ruleCount) {
    ga("cleanup_rule_removed", { cleanup_rule_count: ruleCount });
  },

  roleAdded(roleCount) {
    ga("role_added", { detected_character_count: roleCount });
  },

  roleRemoved(roleCount) {
    ga("role_removed", { detected_character_count: roleCount });
  },

  startingLineSelected(bodyStartLine) {
    ga("starting_line_selected", { body_start_line: bodyStartLine });
  },

  settingChanged(settingName, enabled) {
    ga("setting_changed", { setting_name: settingName, enabled });
  },

  parseStarted({ settings, cleanupRuleCount }) {
    ga("parse_started", {
      cleanup_rule_count: cleanupRuleCount,
      stage_directions_in_cue: Boolean(settings?.includeStageDirectionsInCue),
      include_music_as_lines: Boolean(settings?.includeMusicAsLines),
      case_sensitive: Boolean(settings?.caseSensitive),
      punctuation_required: Boolean(settings?.punctuation),
      timed_mode: Boolean(settings?.timedMode),
    });
  },

  parseSuccess({ practiceLineCount, turnCount, sourceLines }) {
    ga("parse_success", {
      practice_line_count: practiceLineCount,
      turn_count: turnCount,
      source_line_count: sourceLines,
    });
  },

  parseFailed(errorType) {
    ga("parse_failed", { error_type: errorType });
  },

  practiceModeChanged(mode) {
    ga("practice_mode_changed", { practice_mode: mode });
  },

  answerChecked({ result, mode, lineNumber, lineTimeMs, usedHint }) {
    ga("answer_checked", {
      result,
      practice_mode: mode,
      line_number: lineNumber,
      line_time_seconds: Math.max(0, Math.round((lineTimeMs || 0) / 1000)),
      used_hint: Boolean(usedHint),
    });
  },

  hintOpened(lineNumber) {
    ga("hint_opened", { line_number: lineNumber });
  },

  answerRevealed(lineNumber, mode) {
    ga("answer_revealed", { line_number: lineNumber, practice_mode: mode });
  },

  sessionAbandoned({ completedLineCount, practiceLineCount }) {
    ga("session_ended", {
      reason: "early",
      completed_line_count: completedLineCount,
      practice_line_count: practiceLineCount,
    });
  },

  retryStarted(type, practiceLineCount) {
    ga("retry_started", { retry_type: type, practice_line_count: practiceLineCount });
  },

  scriptDeleted() {
    ga("script_deleted");
  },

  parserIssueOpened(lineNumber) {
    ga("parser_issue_opened", { line_number: lineNumber });
  },

  feedbackOpened(kind, from) {
    ga("feedback_opened", { feedback_kind: kind, source_screen: from || "unknown" });
  },

  feedbackSubmitted(kind, from) {
    ga("feedback_submitted", { feedback_kind: kind, source_screen: from || "unknown" });
  },

  feedbackFailed(kind, from) {
    ga("feedback_failed", { feedback_kind: kind, source_screen: from || "unknown" });
  },

  sayHiSubmitted(from) {
    ga("generate_lead", {
      form_name: "say_hi",
      lead_type: "friendly_contact",
      source_screen: from || "unknown",
    });
  },

  dashboardOpened() {
    ga("dashboard_opened");
  },
};

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
