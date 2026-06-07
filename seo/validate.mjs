// ─────────────────────────────────────────────────────────────────────────────
// Your Script - SEO validation (no dependencies)
//
// Validates the GENERATED output in public/ against seo/seo.config.mjs:
// per-page metadata, canonical, OG/Twitter tags, robots meta, single H1,
// JSON-LD parseability + type expectations, FAQPage↔visible-FAQ parity,
// distinct titles/H1s, internal crawl path; plus sitemap.xml (public-only,
// no private routes), robots.txt (OAI-SearchBot + Sitemap + GPTBot disallow),
// llms.txt (public-only), index.html homepage metadata + private-route noindex,
// and the existence of OG/logo/font assets.
//
// Run: `node seo/validate.mjs`  (exits non-zero on any failure)
// Run `node seo/generate.mjs` first (npm test does both).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE,
  PAGES,
  GENERATED_PAGES,
  PRIVATE_ROUTES,
  PRIVATE_DISALLOW,
  CRAWLERS,
  canonicalFor,
  absUrl,
} from "./seo.config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");

let passN = 0;
const failures = [];
const ok = (cond, msg) => (cond ? passN++ : failures.push(msg));
const read = (rel) => readFileSync(join(PUB, rel), "utf8");
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const staticHref = (p) => "/" + p.file;

function meta(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)="${k}"[^>]*content="([^"]*)"`, "i"));
  return m ? m[1] : null;
}
const linkHref = (html, rel) => {
  const m = html.match(new RegExp(`<link[^>]+rel="${rel}"[^>]*href="([^"]*)"`, "i"));
  return m ? m[1] : null;
};
const titleOf = (html) => (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || null;
const h1s = (html) => [...html.matchAll(/<h1[\s>]([\s\S]*?)<\/h1>/gi)].map((m) => m[1].trim());
const ldBlocks = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const ldTypes = (html) => {
  const types = [];
  for (const b of ldBlocks(html)) {
    let obj;
    try { obj = JSON.parse(b); } catch { return null; } // null = parse failure
    const nodes = obj["@graph"] || [obj];
    for (const n of nodes) {
      if (!n) continue;
      if (n["@type"]) types.push(n["@type"]);
      // also count a singular embedded mainEntity (e.g. AboutPage → SoftwareApplication)
      const me = n.mainEntity;
      if (me && !Array.isArray(me) && me["@type"]) types.push(me["@type"]);
    }
  }
  return types;
};

console.log("Validating Your Script SEO output →\n");

// ── per-page ─────────────────────────────────────────────────────────────────
const seenTitles = new Map();
const seenH1 = new Map();
for (const p of GENERATED_PAGES) {
  const tag = p.path;
  if (!existsSync(join(PUB, p.file))) { failures.push(`${tag}: missing file public/${p.file}`); continue; }
  const html = read(p.file);
  const canon = canonicalFor(p.path);

  ok(titleOf(html) === esc(p.title), `${tag}: <title> matches config`);
  ok(meta(html, "description") === esc(p.description), `${tag}: meta description matches config`);
  ok(linkHref(html, "canonical") === canon, `${tag}: canonical = ${canon}`);
  const robots = meta(html, "robots") || "";
  ok(/index/.test(robots) && /follow/.test(robots) && /max-image-preview:large/.test(robots), `${tag}: robots meta present`);

  ok(meta(html, "og:type") === "website", `${tag}: og:type`);
  ok(meta(html, "og:locale") === "en_US", `${tag}: og:locale`);
  ok(meta(html, "og:site_name") === "Your Script", `${tag}: og:site_name`);
  ok(meta(html, "og:title") === esc(p.title), `${tag}: og:title`);
  ok(meta(html, "og:description") === esc(p.description), `${tag}: og:description`);
  ok(meta(html, "og:url") === canon, `${tag}: og:url = canonical`);
  const ogImg = meta(html, "og:image") || "";
  ok(ogImg.startsWith(SITE.urlBase + "/") && /\.png$/.test(ogImg), `${tag}: og:image absolute png`);
  ok(meta(html, "twitter:card") === "summary_large_image", `${tag}: twitter:card`);
  ok(meta(html, "twitter:title") === esc(p.title), `${tag}: twitter:title`);
  ok(meta(html, "twitter:description") === esc(p.description), `${tag}: twitter:description`);
  ok((meta(html, "twitter:image") || "").startsWith(SITE.urlBase + "/"), `${tag}: twitter:image absolute`);

  const hs = h1s(html);
  ok(hs.length === 1, `${tag}: exactly one <h1> (found ${hs.length})`);

  const types = ldTypes(html);
  ok(types !== null, `${tag}: all JSON-LD blocks parse`);
  if (types) for (const t of p.schema || []) ok(types.includes(t), `${tag}: JSON-LD includes ${t}`);

  // FAQPage parity: schema present iff faqs, and each question is visibly rendered
  const hasFaqSchema = (p.schema || []).includes("FAQPage");
  const hasFaqs = (p.faqs || []).length > 0;
  ok(hasFaqSchema === hasFaqs, `${tag}: FAQPage schema present iff visible FAQs exist`);
  for (const f of p.faqs || [])
    ok(html.includes(`<summary>${esc(f.q)}</summary>`), `${tag}: FAQ visible - "${f.q.slice(0, 40)}…"`);

  // crawl path: footer links to >=2 other public pages
  const otherLinks = GENERATED_PAGES.filter((o) => o.slug !== p.slug && html.includes(`href="${staticHref(o)}"`)).length;
  ok(otherLinks >= 2 || html.includes('href="/"'), `${tag}: internal crawl links present`);

  // canonical base everywhere
  ok(!/https?:\/\/(?!www\.yourscript\.app)[^"']*yourscript/i.test(html), `${tag}: only canonical domain used`);

  const tt = titleOf(html);
  if (seenTitles.has(tt)) failures.push(`${tag}: duplicate <title> with ${seenTitles.get(tt)}`); else { seenTitles.set(tt, tag); passN++; }
  const h1 = hs[0];
  if (seenH1.has(h1)) failures.push(`${tag}: duplicate <h1> with ${seenH1.get(h1)}`); else { seenH1.set(h1, tag); passN++; }
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
{
  const sm = read("sitemap.xml");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = PAGES.filter((p) => p.inSitemap).map((p) => canonicalFor(p.path)).sort();
  ok(JSON.stringify(locs.slice().sort()) === JSON.stringify(expected), "sitemap: exactly the public canonical URLs");
  ok(!locs.some((u) => PRIVATE_ROUTES.some((r) => u.endsWith(r) || u.includes(r + "/"))), "sitemap: excludes private routes");
  ok(locs.every((u) => u.startsWith(SITE.urlBase + "/")), "sitemap: canonical domain only");
}

// ── robots.txt ───────────────────────────────────────────────────────────────
{
  const r = read("robots.txt");
  ok(/User-agent:\s*OAI-SearchBot/.test(r), "robots: contains OAI-SearchBot");
  ok(/User-agent:\s*GPTBot\s*\nDisallow:\s*\//.test(r), "robots: GPTBot disallowed by default");
  ok(new RegExp(`Sitemap:\\s*${SITE.urlBase}/sitemap.xml`).test(r), "robots: Sitemap directive");
  for (const d of PRIVATE_DISALLOW) ok(r.includes(`Disallow: ${d}`), `robots: disallows ${d}`);
  for (const ua of CRAWLERS.searchAllowed) ok(r.includes(`User-agent: ${ua}`), `robots: declares ${ua}`);
}

// ── llms.txt ─────────────────────────────────────────────────────────────────
{
  const l = read("llms.txt");
  ok(l.startsWith("# Your Script"), "llms: H1 title");
  ok(l.includes(`> ${SITE.tagline}`), "llms: blockquote summary");
  for (const p of PAGES.filter((p) => p.inLlms)) ok(l.includes(canonicalFor(p.path)), `llms: lists ${p.path}`);
  ok(!PRIVATE_ROUTES.some((r) => l.includes(`(${SITE.urlBase}${r})`)), "llms: no private routes");
}

// ── index.html (homepage) ────────────────────────────────────────────────────
{
  const h = readFileSync(join(ROOT, "index.html"), "utf8");
  ok(linkHref(h, "canonical") === SITE.urlBase + "/", "index.html: canonical = homepage");
  ok(/index/.test(meta(h, "robots") || ""), "index.html: robots meta");
  ok((meta(h, "og:image") || "").startsWith(SITE.urlBase + "/og/"), "index.html: og:image");
  ok(meta(h, "twitter:card") === "summary_large_image", "index.html: twitter:card");
  const types = ldTypes(h);
  ok(types !== null, "index.html: JSON-LD parses");
  for (const t of ["WebSite", "Organization", "SoftwareApplication"]) ok(types && types.includes(t), `index.html: JSON-LD ${t}`);
  ok(h.includes('"/upload"') && /noindex/.test(h), "index.html: private-route noindex script");
}

// ── assets ───────────────────────────────────────────────────────────────────
for (const a of [
  "og/home.png",
  "brand/logo-mark.png",
  "fonts/teko-latin-600-normal.woff2",
  "fonts/inter-tight-latin-500-normal.woff2",
  "fonts/manrope-latin-400-normal.woff2",
]) ok(existsSync(join(PUB, a)), `asset exists: public/${a}`);

// ── report ───────────────────────────────────────────────────────────────────
console.log(`  ${passN} checks passed`);
if (failures.length) {
  console.log(`\n  ${failures.length} FAILED:`);
  for (const f of failures) console.log("   ✗ " + f);
  process.exit(1);
}
console.log("\n✓ All SEO checks passed.");
