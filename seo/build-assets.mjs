// Your Script brand asset builder.
//
// Writes the social card and logo mark from the same source assets used by the
// site: the ink mascot, rough frame, hand underline, and brand fonts. Text is
// converted to paths before rasterizing so home.svg and home.png stay visually
// aligned even when CairoSVG cannot load local web fonts.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const C = { off: "#f2f0e8", paper: "#e6e3d8", ink: "#2c2722", pencil: "#5a5249", gray: "#9a958c" };

const FONT = {
  teko: "public/fonts/teko-latin-600-normal.woff2",
  inter: "public/fonts/inter-tight-latin-500-normal.woff2",
  manrope: "public/fonts/manrope-latin-400-normal.woff2",
};

function textPath(text, font, size, x, y, { fill = C.ink, anchor = "start", spacing = 0 } = {}) {
  const result = execFileSync("python3", [
    resolve(ROOT, "seo/text-path.py"),
    resolve(ROOT, font),
    text,
    String(size),
    String(spacing),
  ], { encoding: "utf8" });
  const { width, paths } = JSON.parse(result);
  const left = anchor === "middle" ? x - width / 2 : x;

  return `<g fill="${fill}" transform="translate(${left.toFixed(3)} ${y})">${paths}</g>`;
}

// Inline the mascot paths because CairoSVG will not load an SVG through <image>.
const mascotRaw = readFileSync(resolve(ROOT, "public/mascots/Primary.svg"), "utf8");
const mascotVB = (mascotRaw.match(/viewBox="([^"]+)"/) || [])[1] || "0 0 1426 1103";
const mascotInner = mascotRaw
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim();
const mascot = (x, y, w, h) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${mascotVB}" preserveAspectRatio="xMidYMid meet" overflow="visible">${mascotInner}</svg>`;

function buildRoughRect(w, h, seed) {
  const amp = Math.min(2.2, Math.min(w, h) * 0.012);
  const wob = (n) => Math.sin(seed * 7.3 + n * 1.7) * amp;
  const r = Math.min(14, h * 0.06, w * 0.06);
  return [
    `M ${r + wob(1)} ${wob(2)}`, `L ${w - r + wob(3)} ${wob(4) - 0.5}`,
    `Q ${w + wob(5)} ${wob(6)} ${w + wob(7) - 0.5} ${r + wob(8)}`,
    `L ${w + wob(9) - 0.5} ${h - r + wob(10)}`,
    `Q ${w + wob(11)} ${h + wob(12)} ${w - r + wob(13)} ${h + wob(14) - 0.5}`,
    `L ${r + wob(15)} ${h + wob(16) - 0.5}`,
    `Q ${wob(17)} ${h + wob(18)} ${wob(19) + 0.5} ${h - r + wob(20)}`,
    `L ${wob(21) + 0.5} ${r + wob(22)}`,
    `Q ${wob(23)} ${wob(24)} ${r + wob(25)} ${wob(26) + 0.5}`, `Z`,
  ].join(" ");
}
function roughFrame(x, y, w, h, seed, sw = 2.4) {
  return (
    `<g transform="translate(${x} ${y})" fill="none" stroke="${C.ink}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${buildRoughRect(w, h, seed + 11)}" stroke-width="${sw * 0.7}" opacity="0.5"/>` +
    `<path d="${buildRoughRect(w, h, seed)}" stroke-width="${sw}"/>` +
    `</g>`
  );
}

const HAND_UNDERLINE =
  "M 4 14 Q 32 4 60 12 Q 88 20 116 12 Q 144 4 172 12 Q 200 20 228 12 Q 256 4 264 14";
const handUnderline = (x, y, w, h = 22) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 268 24" preserveAspectRatio="none" overflow="visible"><path d="${HAND_UNDERLINE}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<pattern id="paper-lines" width="1200" height="38" patternUnits="userSpaceOnUse">
  <path d="M0 37.5H1200" stroke="${C.pencil}" stroke-width="1" opacity="0.08"/>
</pattern>
<pattern id="paper-dots" width="28" height="28" patternUnits="userSpaceOnUse">
  <circle cx="4" cy="4" r="1.1" fill="${C.ink}" opacity="0.045"/>
</pattern>
</defs>
<rect width="1200" height="630" fill="${C.off}"/>
<rect width="1200" height="630" fill="url(#paper-lines)"/>
<rect width="1200" height="630" fill="url(#paper-dots)"/>
<line x1="74" y1="36" x2="74" y2="594" stroke="#aa3c32" stroke-opacity="0.20" stroke-width="1.4"/>
${roughFrame(28, 28, 1144, 574, 3, 2.6)}
${textPath("YOUR SCRIPT", FONT.teko, 34, 88, 82, { spacing: 1.2 })}
${textPath("LINE REHEARSAL COMPANION", FONT.inter, 24, 600, 120, { anchor: "middle", spacing: 5, fill: C.gray })}
${textPath("Your Script", FONT.teko, 164, 600, 282, { anchor: "middle" })}
${handUnderline(360, 304, 480)}
${textPath("Upload a script. Choose your role.", FONT.manrope, 36, 600, 390, { anchor: "middle", fill: C.pencil })}
${textPath("Practice each line from its cue.", FONT.manrope, 36, 600, 438, { anchor: "middle", fill: C.pencil })}
${textPath("yourscript.app", FONT.inter, 25, 600, 562, { anchor: "middle", spacing: 2, fill: C.gray })}
${mascot(935, 348, 154, 176)}
</svg>
`;
writeFileSync(resolve(ROOT, "seo/og/home.svg"), og);

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${C.off}"/>
${roughFrame(26, 26, 460, 460, 5, 3)}
${mascot(70, 58, 372, 396)}
</svg>
`;
writeFileSync(resolve(ROOT, "seo/brand/logo-mark.svg"), logo);
console.log("Wrote seo/og/home.svg and seo/brand/logo-mark.svg");

function rasterize(svgRel, pngRel, w, h) {
  const svg = resolve(ROOT, svgRel);
  const png = resolve(ROOT, pngRel);
  try {
    execFileSync("cairosvg", [svg, "-o", png, "-W", String(w), "-H", String(h)], { stdio: "ignore" });
    console.log("Rasterized " + pngRel);
  } catch (e) {
    console.warn(
      "⚠ Could not rasterize " + pngRel + " (cairosvg not found). " +
        "Install with `pip install cairosvg` and ensure the brand fonts are on the system; " +
        "the committed PNG was left unchanged.",
    );
  }
}
rasterize("seo/og/home.svg", "public/og/home.png", 1200, 630);
rasterize("seo/brand/logo-mark.svg", "public/brand/logo-mark.png", 512, 512);
