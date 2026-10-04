/** Colour maths shared by the gates and the Atlas: parse CSS colours, composite, WCAG contrast, OKLab, and CVD simulation. One copy, so the browser and the gate never disagree. */

export type RGBA = [number, number, number, number]; // 0..1 sRGB, alpha

const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const gam = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map(clamp) as [number, number, number];
}

export function rgbToOklab([r, g, b]: number[]): [number, number, number] {
  const [R, G, B] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Parse #rrggbb, rgba(r,g,b,a) or oklch(L C H) with plain numbers (variables already substituted). */
export function parse(v: string): RGBA {
  v = v.trim();
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).concat(1) as RGBA;
  let m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] ?? 1];
  }
  m = v.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return [...oklchToRgb(p[0], p[1], p[2]), p[3] ?? 1] as RGBA;
  }
  throw new Error(`cannot parse colour: ${v}`);
}

export const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const luminance = (c: RGBA | number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function ratio(a: RGBA, b: RGBA) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const hex = (c: number[]) => '#' + c.slice(0, 3).map((x) => Math.round(clamp(x) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear sRGB. */
const CVD: Record<string, number[][]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
export function simulate(c: number[], kind: 'protan' | 'deutan'): number[] {
  const L = c.slice(0, 3).map(lin), M = CVD[kind];
  return M.map((row) => gam(clamp(row[0] * L[0] + row[1] * L[1] + row[2] * L[2])));
}
/** Delta E as the dataviz method defines it: Euclidean distance in OKLab, x 100. */
export function deltaE(a: number[], b: number[]) {
  const p = rgbToOklab(a), q = rgbToOklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
}
export const oklchOf = (c: number[]) => {
  const [L, a, b] = rgbToOklab(c);
  return { L, C: Math.hypot(a, b) };
};
