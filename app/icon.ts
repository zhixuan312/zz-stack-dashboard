import fs from 'node:fs';
import path from 'node:path';
import { hex, oklchToRgb } from '@/lib/color';

/**
 * The browser tab's icon: ZZ's mark in the product's default accent, read from the tokens at build time, so a new
 * brand (`scripts/brand.ts`) repaints it with nothing else to change. Dark theme values: tabs sit on browser chrome.
 */
export const contentType = 'image/svg+xml';

const token = (file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tokens', file), 'utf8'));

export default function Icon() {
  const id = token('zz-meridian.resolver.json').modifiers.accent.default;
  const preset = token(`accent.${id}.tokens.json`);
  const dark = preset.$extensions?.['dev.zz.meridian']?.overrides?.dark ?? {};
  const l = dark['accent-l'] ?? token('theme.dark.tokens.json').accent['accent-l'].$value;
  const fill = hex(oklchToRgb(l, preset.accent['accent-c'].$value, preset.accent['accent-h'].$value));
  const ink = dark['on-accent'] ?? hex(oklchToRgb(0.99, 0, 0));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="6.5" fill="${fill}"/>
  <path d="M5.5 6.5h7.5l-7.5 11h7.5" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.5 12h4l-4 5.5h4" fill="none" stroke="${ink}" stroke-opacity=".7" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': contentType } });
}
