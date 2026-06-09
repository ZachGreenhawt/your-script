// ─────────────────────────────────────────────────────────────────────────────
// Your Script, SEO generator
//
// Reads seo/seo.config.mjs (single source of truth) and writes, into public/
// (which Vite copies verbatim into dist/):
//   • one static HTML page per generated route, full <head> metadata + canonical
//     + Open Graph + Twitter + JSON-LD (visible-content parity) + body + FAQ +
//     CTA + footer nav
//   • sitemap.xml · robots.txt · llms.txt
//
// Static HTML is deliberate: this is a client-rendered Vite SPA with no SSR, so
// real crawlable content + metadata must live in the initial HTML response (best
// for search + answer engines; zero risk to the app/homepage React tree). Served
// at clean URLs via Vercel `cleanUrls`.
//
// The pages are built in the real product design language (the "Your Story"
// notebook system): pencil-on-cream (#2c2722 on #f2f0e8), self-hosted Teko /
// Inter Tight / Manrope, notebook paper texture, a 3-column chrome bar, a
// centered PaperHeading (eyebrow + rotated Teko title + hand-drawn rule + italic
// subtitle), hand-drawn RoughBox frames (never CSS borders, seo/roughbox.js),
// pencil-button CTAs, squiggle hover underlines, and the ink mascot as the only
// imagery. Saturated color is reserved for grading feedback in the app, so none
// appears here.
//
// Run: `node seo/generate.mjs` (also runs before `vite build`).
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE,
  CRAWLERS,
  PRIVATE_ROUTES,
  PRIVATE_DISALLOW,
  PAGES,
  GENERATED_PAGES,
  canonicalFor,
  absUrl,
} from "./seo.config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUB = join(ROOT, "public");

// Vendored hand-drawn frame decorator (brand non-negotiable: frames are RoughBox).
const ROUGHBOX = readFileSync(resolve(__dirname, "roughbox.js"), "utf8");
const GOOGLE_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4G73FH1XCL"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-4G73FH1XCL');
</script>`;

// Per-page mascot greeter (real ink SVGs in public/mascots, space-free filenames).
const MASCOTS = {
  "what-is-yourscript": "Primary.svg",
  "memorize-lines": "making-progress.svg",
  "how-to-memorize-a-script": "writing.svg",
  "rehearse-without-a-scene-partner": "listening.svg",
  "compare-line-learning-apps": "sorting.svg",
  "audition-sides-practice": "Reviewing.svg",
  "memorize-a-monologue": "writing.svg",
  "cue-to-cue-rehearsal": "listening.svg",
};
// Short uppercase eyebrow + tiny italic subtitle for the PaperHeading hero.
const EYEBROWS = {
  "what-is-yourscript": "Line rehearsal companion",
  "memorize-lines": "Line memorization",
  "how-to-memorize-a-script": "Script memorization",
  "rehearse-without-a-scene-partner": "Solo rehearsal",
  "compare-line-learning-apps": "Choosing an app",
  "audition-sides-practice": "Audition prep",
  "memorize-a-monologue": "Monologue work",
  "cue-to-cue-rehearsal": "Cue practice",
};
const SUBTITLES = {
  "what-is-yourscript": "What the app does, who uses the app, and how rehearsal works.",
  "memorize-lines": "Practical ways to get off-book faster.",
  "how-to-memorize-a-script": "A clear, step-by-step approach.",
  "rehearse-without-a-scene-partner": "Run lines on your own, off your cues.",
  "compare-line-learning-apps": "Find the workflow that fits how you rehearse.",
  "audition-sides-practice": "Get sides ready on a short timeline.",
  "memorize-a-monologue": "Lock a speech without cues to lean on.",
  "cue-to-cue-rehearsal": "What cues are, and how to drill them solo.",
};
const CRUMB = { about: "About", guide: "Guide", comparison: "Compare" };

// ── tiny helpers ─────────────────────────────────────────────────────────────
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const STATIC_HREFS = new Map(GENERATED_PAGES.map((p) => [p.path, "/" + p.file]));

function hrefFor(path) {
  return STATIC_HREFS.get(path) || path;
}

function useStaticLinks(html = "") {
  let out = html;
  for (const page of GENERATED_PAGES) {
    out = out.replaceAll(`href="${page.path}"`, `href="${hrefFor(page.path)}"`);
  }
  return out;
}

const ldScript = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}</script>`;

function write(rel, content) {
  const p = join(PUB, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log("  wrote public/" + rel);
}

// ── hand-drawn marks ─────────────────────────────────────────────────────────
const WAVY = "M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14";
// small left-aligned underline accent under every <h2> (background-image)
const H2_UNDERLINE = (
  "data:image/svg+xml," +
  `<svg xmlns='http://www.w3.org/2000/svg' width='268' height='24' viewBox='0 0 268 24'><path d='${WAVY}' fill='none' stroke='%232c2722' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>`
    .replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s/g, "%20").replace(/"/g, "%22")
).replace(/'/g, "%27");
// the centered PaperHeading rule beneath the H1
const paperRule = `<svg class="paper-heading-rule" viewBox="0 0 268 24" preserveAspectRatio="none" aria-hidden="true"><path d="${WAVY}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
// chrome forward-arrow (hand-stroked inline SVG, matches the app)
const ARROW = `<svg class="chrome-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// squiggle-on-hover underline mask (lifted from styles.css .chrome-link::after)
const SQUIGGLE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 8' preserveAspectRatio='none'><path d='M 1 4 Q 10 1 20 4 T 40 4 T 60 4 T 80 4 T 100 4 T 119 4' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round'/></svg>\") left center / 100% 100% no-repeat";

// ── self-contained brand stylesheet (inlined per page) ───────────────────────
const CSS = `
@font-face{font-family:"Manrope";src:url("/fonts/manrope-latin-400-normal.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Inter Tight";src:url("/fonts/inter-tight-latin-500-normal.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Teko";src:url("/fonts/teko-latin-600-normal.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap}
:root{
 --off-white:#f2f0e8;--paper:#e6e3d8;--ink:#2c2722;--pencil:#5a5249;--gray:#9a958c;--maroon:#3d342a;
 --rule-margin:rgba(170,60,50,.22);--rule-line:rgba(90,82,73,.07);
 --ease:cubic-bezier(0.16,1,0.3,1);
 --font-display:"Teko","Inter Tight","Arial Narrow",sans-serif;
 --font-ui:"Inter Tight",Manrope,ui-sans-serif,sans-serif;
 --font-body:"Manrope",Inter,ui-sans-serif,sans-serif;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{min-height:100vh;margin:0;overflow-x:hidden;background:var(--off-white);color:var(--ink);font-family:var(--font-body);font-weight:400;line-height:1.58;font-size:17px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision}
/* notebook desk: faint ruled guides + radial-dot film grain, fixed behind all */
.paper{position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:repeating-linear-gradient(to bottom,transparent 0 37px,var(--rule-line) 37px 38px)}
.paper::after{content:"";position:absolute;inset:0;opacity:.045;mix-blend-mode:multiply;background-image:radial-gradient(circle,var(--ink) 0 .8px,transparent 1px),radial-gradient(circle,var(--ink) 0 .55px,transparent .8px);background-size:21px 21px,37px 37px;background-position:0 0,13px 9px}
.skip-link{position:absolute;left:-9999px;top:0;background:var(--ink);color:var(--off-white);padding:10px 16px;z-index:30;font-family:var(--font-ui)}
.skip-link:focus{left:0}
/* squiggle hover underline */
.squiggle{position:relative}
.squiggle::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:6px;background:currentColor;-webkit-mask:${SQUIGGLE};mask:${SQUIGGLE};transform:scaleX(0);transform-origin:left center;transition:transform .45s var(--ease)}
.squiggle:hover::after{transform:scaleX(1)}
/* chrome bar (3-column, matches the app) */
.chrome{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;padding:24px clamp(20px,4vw,42px) 0;font-family:var(--font-ui);font-weight:500;font-size:.78rem}
.chrome-mark{justify-self:start;font-family:var(--font-display);font-weight:600;font-size:clamp(1.08rem,1.45vw,1.35rem);letter-spacing:.015em;text-transform:uppercase;color:var(--ink);text-decoration:none;line-height:1}
.chrome-center{justify-self:center;color:var(--gray);letter-spacing:.16em;text-transform:uppercase;font-size:.66rem}
.chrome-cta{justify-self:end;display:inline-flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none}
.chrome-arrow{width:14px;height:14px;transition:transform .36s var(--ease)}
.chrome-cta:hover .chrome-arrow{transform:translateX(4px)}
/* reading sheet + red margin rule */
main.sheet{max-width:720px;margin:0 auto;padding:6px 28px 0;position:relative}
main.sheet::before{content:"";position:absolute;top:0;bottom:0;left:9px;width:1.2px;background:var(--rule-margin)}
/* PaperHeading hero */
.paper-heading{display:grid;justify-items:center;text-align:center;gap:5px;margin:4px auto clamp(24px,5vh,46px);max-width:680px}
.greeter{width:92px;height:92px;object-fit:contain;display:block;margin:0 auto 2px}
.paper-eyebrow{margin:0;font-family:var(--font-ui);font-weight:500;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gray)}
h1{margin:2px 0 0;font-family:var(--font-display);font-weight:600;font-size:clamp(2.45rem,6vw,4.25rem);line-height:.9;color:var(--ink);transform:rotate(-.5deg)}
.paper-heading-rule{width:clamp(180px,44%,360px);height:14px;margin-top:.18em;color:var(--pencil);opacity:.7;overflow:visible}
.paper-subtitle{margin:.55em 0 0;font-family:var(--font-ui);font-style:italic;font-size:1.02rem;color:var(--pencil)}
/* prose */
h2{font-family:var(--font-display);font-weight:600;font-size:clamp(1.62rem,3.5vw,2.28rem);line-height:1;margin:34px 0 11px;padding-bottom:13px;background-image:url("${H2_UNDERLINE}");background-repeat:no-repeat;background-position:left bottom;background-size:142px 8px}
h3{font-family:var(--font-display);font-weight:600;font-size:1.42rem;line-height:1.05;margin:22px 0 4px;color:var(--ink)}
p{margin:13px 0}
ul,ol{margin:13px 0;padding-left:22px}
li{margin:7px 0}
dl{margin:16px 0}
dt{font-family:var(--font-ui);font-weight:600;color:var(--ink);margin-top:14px}
dd{margin:3px 0 0 0;color:var(--pencil)}
a{color:var(--maroon)}
a:hover{color:var(--ink)}
strong{font-weight:600}
/* hand-drawn frames (RoughBox injects an <svg class="rough-box"> as first child) */
[data-rough]{position:relative}
[data-rough]>*:not(.rough-box){position:relative;z-index:1}
.quick-answer{background:rgba(230,227,216,.76);color:var(--ink);padding:8px 24px 18px;margin:14px 0 26px}
.quick-answer h2{font-family:var(--font-ui);font-weight:500;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gray);background:none;padding:0;margin:18px 0 2px}
.quick-answer p{margin:6px 0 0}
/* comparison table, frame is RoughBox, rows use faint ruling (not borders) */
.table-wrap{background:rgba(230,227,216,.76);color:var(--ink);padding:10px 16px 6px;margin:18px 0}
table{border-collapse:collapse;width:100%;font-family:var(--font-ui);font-size:.94rem}
caption{caption-side:bottom;text-align:left;color:var(--pencil);font-style:italic;font-size:.84rem;padding:10px 2px 4px}
th,td{padding:11px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--rule-line)}
thead th{font-weight:600;color:var(--ink);border-bottom:1.5px solid rgba(44,39,34,.22)}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
tbody th{font-weight:600}
.tag{display:inline-block;font-family:var(--font-ui);font-weight:500;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);padding:4px 11px;margin-left:6px;white-space:nowrap}
/* faq — one notebook card; questions divided by faint ruling, not per-item boxes */
.faq{margin-top:30px}
.faq>h2{margin-bottom:14px}
.faq-list{position:relative;background:rgba(230,227,216,.5);color:var(--ink);padding:2px 24px}
.faq-list .rough-box{color:var(--pencil);opacity:.7}
.faq details{margin:0;border-bottom:1px solid rgba(90,82,73,.16)}
.faq details:last-child{border-bottom:0}
.faq summary{cursor:pointer;font-family:var(--font-ui);font-weight:600;font-size:1.02rem;color:var(--ink);padding:17px 0;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:18px}
.faq summary:hover{color:var(--maroon)}
.faq summary:hover .squiggle::after{transform:scaleX(1)}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-family:var(--font-display);font-weight:600;font-size:1.7rem;line-height:1;color:var(--pencil);flex:0 0 auto}
.faq details[open] summary::after{content:"\\2013"}
.faq .answer{padding:0 0 18px}
.faq .answer p{margin:0;color:var(--pencil)}
/* cta */
.cta{background:rgba(230,227,216,.74);color:var(--ink);padding:26px 22px;margin:40px 0 8px;text-align:center}
.cta h2{background:none;padding:0;margin:0 0 6px;transform:rotate(-.4deg)}
.cta p{margin:6px auto 18px;max-width:46ch;color:var(--pencil)}
.cta-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
/* pencil buttons (RoughBox rect frame behind a label) */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;padding:13px 24px;background:transparent;color:var(--ink);font-family:var(--font-ui);font-weight:500;font-size:.92rem;letter-spacing:.04em;text-decoration:none;cursor:pointer}
.btn>span{position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px}
.btn .rough-box{opacity:.82;transition:opacity .22s var(--ease)}
.btn:hover .rough-box{opacity:1}
.btn:hover{color:var(--maroon)}
.btn-ghost{color:var(--pencil)}
/* footer */
.site-foot{max-width:720px;margin:48px auto 0;padding:22px 28px 44px;position:relative}
.site-foot .foot-eyebrow{font-family:var(--font-ui);font-weight:500;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gray);margin:0 0 12px}
.site-foot nav ul{list-style:none;display:flex;flex-wrap:wrap;gap:12px 26px;padding:0;margin:0;font-family:var(--font-ui);font-size:.95rem}
.foot-link{color:var(--pencil);text-decoration:none}
.foot-link:hover{color:var(--ink)}
.foot-note{font-family:var(--font-ui);color:var(--gray);font-size:.86rem;margin:0}
.foot-bottom{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px 24px;margin-top:18px}
.foot-sayhi{font-family:var(--font-ui);font-size:.86rem;color:var(--gray);text-decoration:none}
.foot-sayhi:hover{color:var(--ink)}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
a:focus-visible,summary:focus-visible,.btn:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
@media(max-width:600px){body{font-size:17px}.chrome{padding-left:18px;padding-right:18px}.chrome-center{display:none}main.sheet,.site-foot{padding-left:18px;padding-right:18px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`.trim();

// ── real analytics (fire-and-forget to /api/event; Vercel proxies to the backend
// recordMetric, which records any event name. No allowlist needed) ───────────
const ANALYTICS = `(function(){
  function track(name){
    try{
      fetch("/api/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:name}),keepalive:true}).catch(function(){});
    }catch(e){}
  }
  try{
    track("resource_page_view");
    document.querySelectorAll("details").forEach(function(d){ d.addEventListener("toggle",function(){ if(d.open) track("faq_expand"); }); });
    document.querySelectorAll("a.btn").forEach(function(a){ a.addEventListener("click",function(){ track("cta_click"); }); });
    document.querySelectorAll('a[href^="http"]').forEach(function(a){ a.addEventListener("click",function(){ track("external_link_click"); }); });
  }catch(e){}
})();`;

// ── structured data ──────────────────────────────────────────────────────────
function softwareApp() {
  return {
    "@type": ["SoftwareApplication", "WebApplication"],
    name: SITE.name,
    url: SITE.urlBase + "/",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser.",
    description: SITE.tagline,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.urlBase + "/" },
    audience: [
      { "@type": "Audience", audienceType: "Actors" },
      { "@type": "Audience", audienceType: "Theatre students" },
      { "@type": "Audience", audienceType: "Musical theatre performers" },
    ],
    featureList: [
      "Upload a script",
      "Parse a script into characters and dialogue",
      "Practice lines",
      "Rehearse cue-to-cue",
      "Run lines without a scene partner",
    ],
  };
}

function organization() {
  return {
    "@type": "Organization",
    name: SITE.name,
    url: SITE.urlBase + "/",
    logo: SITE.urlBase + SITE.logo,
    description: SITE.tagline,
    sameAs: SITE.sameAs,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITE.email,
    },
  };
}

function jsonGraph(page) {
  const url = canonicalFor(page.path);
  const website = { "@type": "WebSite", name: SITE.name, url: SITE.urlBase + "/" };
  const graph = [];
  const types = page.schema || [];
  for (const t of types) {
    if (t === "AboutPage") {
      graph.push({
        "@type": "AboutPage",
        "@id": url + "#page",
        url,
        name: page.h1 || page.title,
        description: page.description,
        isPartOf: website,
        inLanguage: "en-US",
        mainEntity: softwareApp(),
      });
    } else if (t === "WebPage") {
      graph.push({
        "@type": "WebPage",
        "@id": url + "#page",
        url,
        name: page.h1 || page.title,
        description: page.description,
        isPartOf: website,
        inLanguage: "en-US",
      });
    } else if (t === "FAQPage") {
      graph.push({
        "@type": "FAQPage",
        "@id": url + "#faq",
        mainEntity: (page.faqs || []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    } else if (t === "SoftwareApplication") {
      if (!types.includes("AboutPage")) graph.push(softwareApp());
    }
  }
  if (types.includes("AboutPage")) graph.push(organization());
  // Breadcrumb (Home › this page) — clarifies IA for Google + AI parsers.
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.urlBase + "/" },
      { "@type": "ListItem", position: 2, name: page.h1 || page.title, item: url },
    ],
  });
  return { "@context": "https://schema.org", "@graph": graph };
}

// ── page fragments ───────────────────────────────────────────────────────────
function renderFaq(faqs) {
  if (!faqs || !faqs.length) return "";
  const items = faqs
    .map(
      (f) => `    <details>
      <summary><span class="squiggle">${esc(f.q)}</span></summary>
      <div class="answer"><p>${esc(f.a)}</p></div>
    </details>`,
    )
    .join("\n");
  return `
<section class="faq" aria-labelledby="faq-title">
  <h2 id="faq-title">Frequently asked questions</h2>
  <div class="faq-list" data-rough data-rough-double data-rough-seed="20">
${items}
  </div>
</section>`;
}

function renderCta(page) {
  const note = page.cta || "Open Your Script and run a scene off its cues.";
  const secondary =
    page.slug === "what-is-yourscript"
      ? { href: "/", label: "Back to home" }
      : { href: hrefFor("/what-is-yourscript"), label: "What is Your Script?" };
  return `
<section class="cta" data-rough data-rough-double data-rough-seed="9" aria-labelledby="cta-title">
  <h2 id="cta-title">Try Your Script on your next scene</h2>
  <p>${esc(note)}</p>
  <p class="cta-actions">
    <a class="btn" href="/upload" rel="nofollow" data-rough data-rough-seed="5"><span>Open Your Script ${ARROW}</span></a>
    <a class="btn btn-ghost" href="${secondary.href}" data-rough data-rough-seed="6"><span>${esc(secondary.label)}</span></a>
  </p>
</section>`;
}

function renderFooter(currentSlug) {
  const links = [{ path: "/", label: "Home" }].concat(
    GENERATED_PAGES.filter((p) => p.slug !== currentSlug).map((p) => ({ path: hrefFor(p.path), label: p.llmsTitle })),
  );
  const lis = links
    .map((l) => `        <li><a class="foot-link squiggle" href="${l.path}">${esc(l.label)}</a></li>`)
    .join("\n");
  return `
  <footer class="site-foot">
    <p class="foot-eyebrow">More from Your Script</p>
    <nav aria-label="Resources">
      <ul>
${lis}
      </ul>
    </nav>
    <div class="foot-bottom">
      <p class="foot-note">${esc(SITE.name)}. A minimal line rehearsal companion for actors and theatre students.</p>
      <a class="foot-sayhi squiggle" href="/feedback?from=resources&amp;kind=say-hi" rel="nofollow">Built by a student. Say hi!</a>
    </div>
  </footer>`;
}

function renderPage(page) {
  const url = canonicalFor(page.path);
  const ogImg = absUrl(page.ogImage || SITE.ogImage);
  const t = esc(page.title);
  const d = esc(page.description);
  const mascot = MASCOTS[page.slug] || "Primary.svg";
  const eyebrow = EYEBROWS[page.slug] || "Line rehearsal companion";
  const subtitle = SUBTITLES[page.slug] || SITE.tagline;
  const crumb = CRUMB[page.type] || "Guide";
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
${GOOGLE_TAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<link rel="icon" href="/favicon.ico" />
<link rel="preload" as="font" type="font/woff2" href="/fonts/teko-latin-600-normal.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/fonts/manrope-latin-400-normal.woff2" crossorigin />
<meta property="og:type" content="website" />
<meta property="og:locale" content="${SITE.locale}" />
<meta property="og:site_name" content="${esc(SITE.name)}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${ogImg}" />
<meta property="og:image:alt" content="${esc(SITE.name)} — ${esc(SITE.tagline)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${ogImg}" />
<meta name="twitter:image:alt" content="${esc(SITE.name)} — ${esc(SITE.tagline)}" />
<style>${CSS}</style>
${ldScript(jsonGraph(page))}
</head>
<body>
<div class="paper" aria-hidden="true"></div>
<a class="skip-link" href="#main">Skip to content</a>
<header class="chrome">
  <a class="chrome-mark squiggle" href="/">Your Script</a>
  <span class="chrome-center">${esc(crumb)}</span>
  <a class="chrome-cta squiggle" href="/upload" rel="nofollow">Open the app ${ARROW}</a>
</header>
<main id="main" class="sheet">
  <div class="paper-heading">
    <img class="greeter" src="/mascots/${mascot}" alt="" width="116" height="116" />
    <p class="paper-eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(page.h1)}</h1>
    ${paperRule}
    <p class="paper-subtitle">${esc(subtitle)}</p>
  </div>
${useStaticLinks(page.body).trim()}
${renderFaq(page.faqs)}
${renderCta(page)}
</main>
${renderFooter(page.slug)}
<script>${ROUGHBOX}</script>
<script>${ANALYTICS}</script>
</body>
</html>
`;
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
function buildSitemap() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const entries = PAGES.filter((p) => p.inSitemap);
  for (const p of entries) {
    if (PRIVATE_ROUTES.some((r) => p.path === r || p.path.startsWith(r + "/"))) {
      throw new Error(`Refusing to add private route to sitemap: ${p.path}`);
    }
  }
  const urls = entries
    .map((p) => `  <url>\n    <loc>${canonicalFor(p.path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ── robots.txt ───────────────────────────────────────────────────────────────
function buildRobots() {
  const disallow = PRIVATE_DISALLOW.map((p) => `Disallow: ${p}`).join("\n");
  const allowedGroup = (ua) => `User-agent: ${ua}\nAllow: /\n${disallow}`;
  const blockedGroup = (ua) => `User-agent: ${ua}\nDisallow: /`;
  const lines = [];
  lines.push("# robots.txt, Your Script (https://www.yourscript.app)");
  lines.push("# Generated by seo/generate.mjs from seo/seo.config.mjs. Edit there, not here.");
  lines.push("# Public marketing/guide pages are crawlable; the app, account, and API");
  lines.push("# surfaces are not. Private routes are ALSO noindex'd in-page. robots.txt");
  lines.push("# is a crawl directive, not a privacy/deindex mechanism.");
  lines.push("");
  lines.push(allowedGroup("*"));
  lines.push("");
  lines.push("# ── Major search engines (explicit; same private-route exclusions) ──");
  for (const ua of ["Googlebot", "Bingbot"]) { lines.push(""); lines.push(allowedGroup(ua)); }
  lines.push("");
  lines.push("# ── AI / answer engines ──────────────────────────────────────────────");
  lines.push("# Policy: allow search/answer + user-retrieval crawlers (how Your Script gets");
  lines.push("# cited); disallow pure model-training crawlers by default. Blocking training");
  lines.push("# does NOT affect citation in ChatGPT/Claude/Perplexity/Google. Business");
  lines.push("# decision. Move a name in seo/seo.config.mjs to change the policy.");
  for (const ua of CRAWLERS.searchAllowed.filter((u) => !["Googlebot", "Bingbot"].includes(u))) {
    lines.push(""); lines.push(allowedGroup(ua));
  }
  for (const ua of CRAWLERS.trainingDisallowed) { lines.push(""); lines.push(blockedGroup(ua)); }
  lines.push("");
  lines.push(`Sitemap: ${SITE.urlBase}/sitemap.xml`);
  lines.push("");
  return lines.join("\n");
}

// ── llms.txt (llmstxt.org format) ────────────────────────────────────────────
function buildLlms() {
  const order = ["Core", "Guides", "Comparison"];
  const out = [];
  out.push(`# ${SITE.name}`);
  out.push("");
  out.push(`> ${SITE.tagline}`);
  out.push("");
  out.push(
    "Your Script is a web app focused on line rehearsal: solo practice, cue-based repetition, and getting off-book without a complicated production-management workflow.",
  );
  out.push("");
  out.push(`- Canonical: ${SITE.urlBase}/`);
  out.push(`- Sitemap: ${SITE.urlBase}/sitemap.xml`);
  for (const section of order) {
    const pages = PAGES.filter((p) => p.inLlms && p.llmsSection === section);
    if (!pages.length) continue;
    out.push("");
    out.push(`## ${section}`);
    out.push("");
    for (const p of pages) out.push(`- [${p.llmsTitle}](${canonicalFor(p.path)}): ${p.llmsDesc}`);
  }
  out.push("");
  out.push("## Optional");
  out.push("");
  out.push(`- [Sitemap](${SITE.urlBase}/sitemap.xml): Canonical public URLs available for crawling.`);
  out.push("");
  return out.join("\n");
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log("Generating Your Script SEO surface →");
for (const page of GENERATED_PAGES) write(page.file, renderPage(page));
write("sitemap.xml", buildSitemap());
write("robots.txt", buildRobots());
write("llms.txt", buildLlms());
console.log(`Done: ${GENERATED_PAGES.length} pages + sitemap.xml + robots.txt + llms.txt`);
