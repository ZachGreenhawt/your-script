export const COLORS = {
  offBlack: "#2c2722",
  offWhite: "#f2f0e8",
  gray: "#9a958c",
  maroon: "#3d342a",
  ink: "#2c2722",
  pencil: "#5a5249",
  paper: "#e6e3d8",
};

export function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp(t);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutQuart(x) {
  const t = clamp(x);
  return 1 - Math.pow(1 - t, 4);
}

export function easeInOutQuart(x) {
  const t = clamp(x);
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

export function phaseProgress(globalProgress, start, end) {
  return clamp((globalProgress - start) / (end - start));
}
