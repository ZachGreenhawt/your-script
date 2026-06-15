/* ───────────────────────────────────────────────────────────────────────────
 * Your Script — consent UI (Google Consent Mode v2)
 *
 * The inline <head> snippet (in index.html and the generated pages) has already
 * set the Consent Mode *defaults* before gtag config, based on region + any
 * stored choice. This file only renders the UI and records changes:
 *   • EU / EEA / UK / CH visitors: ad + analytics signals start DENIED and a
 *     banner asks them to opt in (Accept / Decline).
 *   • Everyone else: signals start GRANTED; no banner, but "Privacy choices"
 *     (footer + privacy page) lets them opt out at any time.
 * Reads window.__ys = { consentRequired, consentChoice } left by the snippet.
 * ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  var STORE_KEY = "ys-consent";
  var state = window.__ys || { consentRequired: false, consentChoice: null };

  function gtagSafe() {
    if (typeof window.gtag === "function") window.gtag.apply(window, arguments);
  }

  function apply(granted) {
    var v = granted ? "granted" : "denied";
    gtagSafe("consent", "update", {
      ad_storage: v,
      ad_user_data: v,
      ad_personalization: v,
      analytics_storage: v,
    });
  }

  function save(choice) {
    try {
      localStorage.setItem(STORE_KEY, choice);
    } catch (e) {}
    state.consentChoice = choice;
  }

  function injectStyle() {
    if (document.getElementById("ys-consent-style")) return;
    var css =
      ".ys-c-root{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;" +
      "display:flex;justify-content:center;padding:16px;pointer-events:none;" +
      'font-family:"Inter Tight",Manrope,system-ui,sans-serif}' +
      ".ys-c-card{pointer-events:auto;max-width:540px;width:100%;" +
      "background:var(--paper,#e6e3d8);color:var(--ink,#2c2722);" +
      "border:1.5px solid var(--ink,#2c2722);border-radius:14px;" +
      "box-shadow:0 10px 34px rgba(44,39,34,.22);padding:18px 20px;" +
      "opacity:0;transform:translateY(10px);transition:opacity .36s cubic-bezier(.16,1,.3,1),transform .36s cubic-bezier(.16,1,.3,1)}" +
      ".ys-c-card.ys-in{opacity:1;transform:none}" +
      ".ys-c-title{font-weight:600;font-size:.82rem;letter-spacing:.14em;" +
      "text-transform:uppercase;margin:0 0 8px}" +
      ".ys-c-body{font-family:Manrope,system-ui,sans-serif;font-size:.92rem;" +
      "line-height:1.5;margin:0 0 14px;color:var(--pencil,#5a5249)}" +
      ".ys-c-body a{color:var(--ink,#2c2722)}" +
      ".ys-c-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}" +
      ".ys-c-btn{font:inherit;font-size:.74rem;letter-spacing:.12em;" +
      "text-transform:uppercase;cursor:pointer;border-radius:10px;" +
      "padding:9px 16px;border:1.5px solid var(--ink,#2c2722);transition:background .2s,color .2s}" +
      ".ys-c-accept{background:var(--ink,#2c2722);color:var(--paper,#e6e3d8)}" +
      ".ys-c-accept:hover{background:var(--maroon,#3d342a)}" +
      ".ys-c-decline{background:transparent;color:var(--ink,#2c2722)}" +
      ".ys-c-decline:hover{background:rgba(44,39,34,.08)}" +
      ".ys-c-link{margin-left:auto;font-size:.72rem;letter-spacing:.08em;" +
      "color:var(--gray,#9a958c);text-decoration:none}" +
      ".ys-c-link:hover{color:var(--ink,#2c2722)}" +
      ".ys-c-state{font-family:Manrope,system-ui,sans-serif;font-size:.8rem;" +
      "color:var(--gray,#9a958c);margin:10px 2px 0}" +
      "@media (max-width:600px){.ys-c-link{margin-left:0;width:100%}}";
    var s = document.createElement("style");
    s.id = "ys-consent-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  var root = null;

  function close() {
    if (!root) return;
    var card = root.querySelector(".ys-c-card");
    if (card) card.classList.remove("ys-in");
    var node = root;
    root = null;
    setTimeout(function () {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, 380);
  }

  // mode: "banner" (first-run opt-in) or "manage" (re-open from a control)
  function open(mode) {
    injectStyle();
    if (root) close();
    var current =
      state.consentChoice === "granted"
        ? "on"
        : state.consentChoice === "denied"
          ? "off"
          : state.consentRequired
            ? "off"
            : "on";

    root = document.createElement("div");
    root.className = "ys-c-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "Privacy choices");

    var lede =
      mode === "manage"
        ? "Your Script uses Google Analytics (including Google Signals ad features) to understand how the app is used. You can turn this on or off below."
        : "Your Script uses Google Analytics, including Google Signals ad features, to understand how the app is used. May we turn this on? You can change this anytime under Privacy choices.";

    var stateLine =
      mode === "manage"
        ? '<p class="ys-c-state">Currently: analytics & ad signals are <strong>' +
          (current === "on" ? "on" : "off") +
          "</strong>.</p>"
        : "";

    root.innerHTML =
      '<div class="ys-c-card">' +
      '<p class="ys-c-title">Privacy choices</p>' +
      '<p class="ys-c-body">' +
      lede +
      ' <a href="/privacy.html">Read the privacy page</a>.</p>' +
      '<div class="ys-c-actions">' +
      '<button type="button" class="ys-c-btn ys-c-accept">Allow analytics</button>' +
      '<button type="button" class="ys-c-btn ys-c-decline">' +
      (current === "on" ? "Turn off" : "No thanks") +
      "</button>" +
      '<a class="ys-c-link" href="/privacy.html">Privacy</a>' +
      "</div>" +
      stateLine +
      "</div>";

    document.body.appendChild(root);
    root.querySelector(".ys-c-accept").addEventListener("click", function () {
      save("granted");
      apply(true);
      close();
    });
    root.querySelector(".ys-c-decline").addEventListener("click", function () {
      save("denied");
      apply(false);
      close();
    });
    requestAnimationFrame(function () {
      var card = root && root.querySelector(".ys-c-card");
      if (card) card.classList.add("ys-in");
    });
  }

  // Public entry point used by [data-ys-privacy-choices] controls.
  window.openPrivacyChoices = function () {
    open("manage");
  };

  function wireControls() {
    var nodes = document.querySelectorAll("[data-ys-privacy-choices]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener("click", function (e) {
        e.preventDefault();
        open("manage");
      });
    }
  }

  function start() {
    wireControls();
    // First-run banner only where consent is required and not yet chosen.
    if (state.consentRequired && !state.consentChoice) open("banner");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
