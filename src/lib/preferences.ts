/** Appearance preferences: theme, accent and density, stored on the device and applied as attributes on <html>. */
import { slug } from '@/app.config';
const THEMES = ['system', 'dark', 'light'] as const;
export const ACCENTS = ['indigo', 'cobalt', 'jade', 'graphite', 'zz'] as const;
const DENSITIES = ['comfortable', 'compact'] as const;
type ThemePref = (typeof THEMES)[number];
type Accent = (typeof ACCENTS)[number];
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
