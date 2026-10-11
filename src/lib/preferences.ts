/** Appearance preferences: theme, accent and density, stored on the device and applied as attributes on <html>. */
import { app, slug } from '../app.config';

const PRESET_ACCENTS = ['indigo', 'cobalt', 'jade', 'graphite'];
// The optional keys are read through a widened type, so an app configuration without them still type checks.
const cfg: { accent: string; theme?: 'dark' | 'light' } = app;
/** The four presets, plus the product's own accent when `app.accent` is not one of them. */
export const ACCENTS: readonly string[] = PRESET_ACCENTS.includes(cfg.accent) ? PRESET_ACCENTS : [...PRESET_ACCENTS, cfg.accent];
type ThemePref = 'system' | 'dark' | 'light';
type Accent = string;
type Density = 'comfortable' | 'compact';
export type Preferences = { theme: ThemePref; accent: Accent; density: Density; /** Whether the assistant's launcher and panel show, when the product has one. */ assistant: boolean };

/** Per product, from the name: two Meridian apps on one host keep their own theme and accent. */
export const STORAGE_KEY = `${slug}.preferences`;

/**
 * Runs before the first paint (inlined in <head>), so a stored choice never flashes the other theme.
 * Kept as a string: it must not depend on the bundle having loaded.
 */
export const PREPAINT = `(function(){try{var p=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}'),d=document.documentElement,t=p.theme||${JSON.stringify(cfg.theme ?? 'system')};
if(t==='light'||t==='dark')d.setAttribute('data-theme',t);
if(p.accent)d.setAttribute('data-accent',p.accent);if(p.density)d.setAttribute('data-density',p.density);}catch(e){}})();`;
