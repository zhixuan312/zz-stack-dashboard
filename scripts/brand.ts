/**
 * Brand the console in place: its name, zone and accent. Meridian's own script, less the Design Atlas branches the
 * console has no Atlas for.
 *
 *   node scripts/brand.ts --name "Atlas Ops" [--workspace "Production"] [--timezone "Europe/London"]
 *                         [--package atlas-ops] [--accent indigo|cobalt|jade|graphite]
 *                         [--currency EUR] [--user "Ada Park" --role Admin]
 *                         [--hex '#E4572E' | --hue 25 --chroma 0.16] [--accent-name brand]
 *
 * --hex derives the hue and chroma from a brand colour (chroma capped at 0.18; the theme owns lightness).
 * --hue/--chroma add a new accent preset (OKLCH hue in degrees, chroma 0 to 0.2) and make it the default. The contrast
 * gate then runs; where white on the accent fill fails in a theme, the preset gets a lower fill lightness for that
 * theme, a step at a time, until every pair in every theme passes.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse, rgbToOklab } from '../src/lib/color.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const has = (k: string) => argv.includes(k);
const file = (p: string) => path.join(ROOT, p);
const read = (p: string) => fs.readFileSync(file(p), 'utf8');
const write = (p: string, s: string) => fs.writeFileSync(file(p), s);
const json = (p: string) => JSON.parse(read(p));
const done: string[] = [];

function setConfig(key: string, value: string) {
  const s = read('src/app.config.ts');
  const re = new RegExp(`(\\n  ${key}: )'[^']*'`);
  if (!re.test(s)) throw new Error(`src/app.config.ts has no "${key}"`);
  write('src/app.config.ts', s.replace(re, `$1'${value.replace(/'/g, "\\'")}'`));
  done.push(`${key} = ${value}`);
}

const name = opt('--name');
if (name) setConfig('name', name);
const workspace = opt('--workspace');
if (workspace) setConfig('workspace', workspace);
const timezone = opt('--timezone');
if (timezone) setConfig('timezone', timezone);
const currency = opt('--currency');
if (currency) {
  try { new Intl.NumberFormat('en', { style: 'currency', currency }); } catch { throw new Error('--currency is an ISO 4217 code, such as USD, EUR or GBP'); }
  setConfig('currency', currency.toUpperCase());
}
const user = opt('--user'), role = opt('--role');
if (user || role) {
  const s = read('src/app.config.ts');
  const m = s.match(/user: \{ name: '([^']*)', role: '([^']*)' \}/);
  if (!m) throw new Error('src/app.config.ts has no "user"');
  const esc = (v: string) => v.replace(/'/g, "\\'");
  write('src/app.config.ts', s.replace(m[0], `user: { name: '${esc(user ?? m[1])}', role: '${esc(role ?? m[2])}' }`));
  done.push(`user = ${user ?? m[1]}, ${role ?? m[2]}`);
}

const pkg = opt('--package') ?? (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : undefined);
if (pkg) {
  const p = json('package.json');
  p.name = pkg;
  p.version = '0.1.0';
  p.description = `${name ?? pkg}: a dashboard built on Meridian.`;
  write('package.json', JSON.stringify(p, null, 2) + '\n');
  done.push(`package = ${pkg}`);
}

/** Make an accent the default everywhere: the resolver, the app config, and the CSS. */
function defaultAccent(id: string) {
  const r = json('tokens/zz-meridian.resolver.json');
  if (!r.modifiers.accent.contexts[id]) throw new Error(`no accent "${id}"; presets are ${Object.keys(r.modifiers.accent.contexts).join(', ')}`);
  r.modifiers.accent.default = id;
  write('tokens/zz-meridian.resolver.json', JSON.stringify(r, null, 2) + '\n');
  const s = read('src/app.config.ts').replace(/accent: '[^']*' as const/, `accent: '${id}' as const`);
  write('src/app.config.ts', s);
  done.push(`accent = ${id}`);
}

const hex = opt('--hex');
let hue = opt('--hue'), chroma = opt('--chroma');
if (hex) {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) throw new Error('--hex is a colour such as #E4572E');
  const [, a, b] = rgbToOklab(parse('#' + hex.replace('#', '')));
  hue = String(Math.round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360));
  chroma = String(Math.min(0.18, Math.round(Math.hypot(a, b) * 100) / 100));
  done.push(`${hex} is OKLCH hue ${hue}, chroma ${chroma}`);
}
if (hue !== undefined) {
  const h = Number(hue), c = Number(chroma ?? '0.16');
  const id = opt('--accent-name') ?? 'brand';
  if (!Number.isFinite(h) || h < 0 || h > 360) throw new Error('--hue is an OKLCH hue in degrees, 0 to 360');
  if (!Number.isFinite(c) || c < 0 || c > 0.24) throw new Error('--chroma is OKLCH chroma, 0 to 0.24 (0.12 to 0.18 is typical)');
  const tokens = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
    $description: `Accent preset: ${id}. The product's brand hue.`,
    accent: {
      $description: 'The two numbers a preset owns.',
      'accent-h': { $type: 'number', $value: h, $description: 'Hue, in OKLCH degrees.' },
      'accent-c': { $type: 'number', $value: c, $description: 'Chroma, in OKLCH.' },
    },
    $extensions: { 'dev.zz.meridian': { overrides: { light: {}, dark: {} } as Record<string, Record<string, number>> } },
  };
  const tokenFile = `tokens/accent.${id}.tokens.json`;
  write(tokenFile, JSON.stringify(tokens, null, 2) + '\n');
  const r = json('tokens/zz-meridian.resolver.json');
  r.modifiers.accent.contexts[id] = [{ $ref: `accent.${id}.tokens.json` }];
  write('tokens/zz-meridian.resolver.json', JSON.stringify(r, null, 2) + '\n');
  let prefs = read('src/lib/preferences.ts');
  if (!prefs.includes(`'${id}'`)) {
    prefs = prefs.replace(/export const ACCENTS = \[([^\]]*)\] as const;/, (_, list) => `export const ACCENTS = [${list}, '${id}'] as const;`);
    write('src/lib/preferences.ts', prefs);
  }
  defaultAccent(id);

  // Hold contrast: lower a theme's fill lightness where white text on it fails, a step at a time.
  const base = { light: 0.52, dark: 0.56 };
  for (let step = 0; step < 8; step++) {
    execFileSync('node', ['scripts/tokens.ts'], { cwd: ROOT, stdio: 'ignore' });
    let out = '';
    try { out = execFileSync('node', ['scripts/contrast.ts'], { cwd: ROOT, encoding: 'utf8' }); break; }
    catch (e: any) { out = String(e.stdout ?? ''); }
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL') && l.includes(` ${id} `));
    if (!fails.length) break;
    const t = JSON.parse(read(tokenFile));
    for (const theme of ['light', 'dark'] as const) {
      if (!fails.some((l) => l.includes(`FAIL ${theme}`) && /on-accent on accent/.test(l))) continue;
      const o = (t.$extensions['dev.zz.meridian'].overrides[theme] ||= {});
      o['accent-l'] = Math.round(((o['accent-l'] ?? base[theme]) - 0.02) * 100) / 100;
      o['accent-l-hover'] = Math.round((o['accent-l'] - 0.05) * 100) / 100;
    }
    write(tokenFile, JSON.stringify(t, null, 2) + '\n');
    if (step === 7) console.log('Contrast still fails for this hue; lower --chroma and run again:\n' + fails.join('\n'));
  }
  done.push(`accent ${id}: hue ${h}, chroma ${c}`);

  // A brand hue close to a status hue makes every accent fill read as a state: a jade brand looks like "healthy".
  const status = json('tokens/palette.tokens.json').palette.status as Record<string, { $value: { components: number[] } }>;
  const hues = new Map<string, number>();
  for (const [name, t] of Object.entries(status)) hues.set(name.split('-')[0], hues.get(name.split('-')[0]) ?? t.$value.components[2]);
  for (const [role, sh] of hues) {
    const d = Math.min(Math.abs(h - sh), 360 - Math.abs(h - sh));
    if (d < 20) done.push(`warning: hue ${h} is ${Math.round(d)}° from the ${role} status hue (${sh}); accent fills will read as ${role}. Consider graphite, or a hue at least 20° away, and keep the brand colour in the logo`);
  }
} else {
  const accent = opt('--accent');
  if (accent) defaultAccent(accent);
}

execFileSync('node', ['scripts/tokens.ts'], { cwd: ROOT, stdio: 'ignore' });
console.log(done.length ? 'brand:\n  ' + done.join('\n  ') : 'brand: nothing to change (see the usage at the top of scripts/brand.ts)');
