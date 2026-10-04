/** Appearance preferences: theme, accent and density, stored on the device and applied as attributes on <html>. */
import { slug } from '@/app.config';
const THEMES = ['system', 'dark', 'light'] as const;
export const ACCENTS = ['indigo', 'cobalt', 'jade', 'graphite', 'zz'] as const;
/** A swatch for each accent preset, for pickers. The fill lightness is the dark theme's; graphite is ink itself. */
export const ACCENT_SWATCH: Record<(typeof ACCENTS)[number], string> = { indigo: 'oklch(0.56 0.2 277)', cobalt: 'oklch(0.56 0.17 255)', jade: 'oklch(0.56 0.12 168)', graphite: 'var(--ink)', zz: 'oklch(0.56 0.18 292)' };
const DENSITIES = ['comfortable', 'compact'] as const;
type ThemePref = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];
type Density = (typeof DENSITIES)[number];
export type Preferences = { theme: ThemePref; accent: Accent; density: Density };

/** Per product, from the name: two Meridian apps on one host keep their own theme and accent. */
export const STORAGE_KEY = `${slug}.preferences`;

/**
 * Runs before the first paint (inlined in <head>), so a stored choice never flashes the other theme.
 * Kept as a string: it must not depend on the bundle having loaded.
 */
export const PREPAINT = `(function(){try{var p=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}'),d=document.documentElement;
if(p.theme==='light'||p.theme==='dark')d.setAttribute('data-theme',p.theme);
if(p.accent)d.setAttribute('data-accent',p.accent);if(p.density)d.setAttribute('data-density',p.density);}catch(e){}})();`;
