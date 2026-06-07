// Vanilla RoughBox decorator (lifted verbatim from the Your Story design system,
// preview/roughbox.js). Add data-rough (or data-rough="pill") to a positioned
// element; a hand-drawn SVG pencil frame is injected and kept fitted via
// ResizeObserver. Optional: data-rough-seed, data-rough-double, data-rough-stroke.
// Every frame on the SEO pages is this. Never a CSS border.
(function () {
  function buildRoughRect(w, h, seed) {
    const amp = Math.min(1.6, Math.min(w, h) * 0.04);
    const wob = (n) => Math.sin(seed * 7.3 + n * 1.7) * amp;
    const r = Math.min(8, h * 0.18, w * 0.18);
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
  function buildRoughPill(w, h, seed) {
    const amp = Math.min(1.4, Math.min(w, h) * 0.04);
    const wob = (n) => Math.sin(seed * 6.1 + n * 1.9) * amp;
    const r = Math.min(h / 2, w / 2);
    const cp = r * 0.55;
    return [
      `M ${r + wob(1)} ${wob(2)}`, `L ${w - r + wob(3)} ${wob(4) - 0.5}`,
      `C ${w - r + cp + wob(5)} ${wob(6)} ${w + wob(7)} ${cp + wob(8)} ${w + wob(9) - 0.5} ${r}`,
      `C ${w + wob(10)} ${h - cp + wob(11)} ${w - r + cp + wob(12)} ${h + wob(13)} ${w - r + wob(14)} ${h + wob(15) - 0.5}`,
      `L ${r + wob(16)} ${h + wob(17) - 0.5}`,
      `C ${r - cp + wob(18)} ${h + wob(19)} ${wob(20)} ${h - cp + wob(21)} ${wob(22) + 0.5} ${r}`,
      `C ${wob(23)} ${cp + wob(24)} ${r - cp + wob(25)} ${wob(26)} ${r + wob(27)} ${wob(28) + 0.5}`, `Z`,
    ].join(" ");
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function decorate(el) {
    const variant = el.getAttribute("data-rough") || "rect";
    const seed = Number(el.getAttribute("data-rough-seed") || 1);
    const sw = Number(el.getAttribute("data-rough-stroke") || 1.4);
    const dbl = el.hasAttribute("data-rough-double");
    const builder = variant === "pill" ? buildRoughPill : buildRoughRect;
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "rough-box");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;color:inherit;";
    const p1 = document.createElementNS(SVGNS, "path");
    p1.setAttribute("fill", "none"); p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", sw); p1.setAttribute("stroke-linecap", "round");
    p1.setAttribute("stroke-linejoin", "round"); p1.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(p1);
    let p2 = null;
    if (dbl) {
      p2 = document.createElementNS(SVGNS, "path");
      p2.setAttribute("fill", "none"); p2.setAttribute("stroke", "currentColor");
      p2.setAttribute("stroke-width", sw * 0.7); p2.setAttribute("stroke-linecap", "round");
      p2.setAttribute("stroke-linejoin", "round"); p2.setAttribute("vector-effect", "non-scaling-stroke");
      p2.setAttribute("opacity", "0.5");
      svg.appendChild(p2);
    }
    el.insertBefore(svg, el.firstChild);
    const fit = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(20, Math.round(r.width)), h = Math.max(20, Math.round(r.height));
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      p1.setAttribute("d", builder(w, h, seed));
      if (p2) p2.setAttribute("d", builder(w, h, seed + 11));
    };
    fit();
    new ResizeObserver(fit).observe(el);
  }
  function run() { document.querySelectorAll("[data-rough]").forEach(decorate); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
