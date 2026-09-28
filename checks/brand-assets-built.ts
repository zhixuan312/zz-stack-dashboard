/* Provenance and reproducibility for the runtime assets: every file the browser downloads must
 * derive from a master under `design/in-use/`, and running the script again must produce the same
 * image. The same property `app-icons-rebuilt.ts` holds for the icon script, and both assert it
 * over decoded pixels rather than encoded bytes — see the digest's own note.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const DIR = 'public/assets/brand';
const WANT = ['wordmark.png', 'mascot-hero.png', 'state-empty.png', 'state-welcome.png',
              'state-error.png', 'state-notfound.png',
              'state-approved.png', 'state-goodbye.png', 'state-thinking.png'];
let code = 0;
const src = readFileSync('scripts/build-brand-assets.py', 'utf8');
if (!src.includes('design/in-use')) { console.error('FAIL script does not read design/in-use'); code = 1; }
if (/design\/reference/.test(src)) { console.error('FAIL script reads a contact sheet, not a master'); code = 1; }
/* DELIBERATE: there is no `state-working`. A spinner already says "working", and an
 * illustration that appears briefly and vanishes is a flicker. */
if (/state-working/.test(src)) { console.error('FAIL script builds state-working; a spinner already says working'); code = 1; }
/* The script must refuse to upscale — a soft image is worse than a missing one. */
if (!/upscal/i.test(src)) { console.error('FAIL script has no upscale guard'); code = 1; }
for (const f of WANT) {
  if (!existsSync(DIR + '/' + f)) { console.error('FAIL missing ' + f); code = 1; }
}
/* No @2x files, and their absence is the assertion. `@2x` is an Apple / CSS `image-set()`
 * filename convention; `next/image` has none — it builds a srcset against its own optimizer and
 * scales down from the single source, so a @2x file can be requested by no mechanism. */
for (const f of readdirSync(DIR)) {
  if (f.includes('@2x')) { console.error(`FAIL ${f} — next/image never requests a @2x filename`); code = 1; }
}
/* Nothing ships that nothing names. `public/` is downloaded by a browser, so an orphan here is
 * not merely untidy: provenance and reproducibility say an asset is correct, and nothing about
 * whether it is wanted.
 *
 * DELIBERATE: there is no `@2x` exemption. Density selection by filename is true of CSS
 * `image-set()` and of Apple's convention, and false of `next/image`, so such an exemption
 * hides exactly the orphans it excuses. Every PNG here must be named by a source file. */
const walkSrc = (d: string, o: string[] = []): string[] => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const q = d + '/' + e.name;
    if (e.isDirectory()) walkSrc(q, o);
    else if (/\.(tsx?|css)$/.test(q)) o.push(readFileSync(q, 'utf8'));
  }
  return o;
};
const sources = [...walkSrc('app'), ...walkSrc('src')].join('\n');
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.png')) continue;
  if (!sources.includes('assets/brand/' + f)) {
    console.error(`FAIL ${f} ships to the browser and nothing references it`); code = 1;
  }
}

/* The digest is over the DECODED pixels, not the files' bytes. PNG encoding is a property of the
 * Pillow build's zlib/libpng, so Linux and macOS produce different bytes for pixel-for-pixel identical
 * images; comparing bytes asserted a property of the encoder's PLATFORM and could only pass on the
 * machine that produced these files. CI found that the first time it ran this on Linux: eight of nine
 * files hashed differently and every one decoded to the same pixels. The DERIVATION is what has to be
 * reproducible, and the generator's `--digest` prints exactly that. */
/* python3 AND Pillow, for the reason `app-icons-rebuilt.ts` states: the spawn throws without them,
 * and the gate's line then names the assets rather than the missing dependency. Failing with the
 * reason is right; skipping would be a check that passed because it never ran. */
const py = (args: string[]) => {
  try {
    return execFileSync('python3', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const detail = (e.stderr || e.message || '').trim().split('\n').slice(-3).join(' ');
    console.error('FAIL brand-assets-built cannot run scripts/build-brand-assets.py — it needs ' +
      `python3 with Pillow installed (\`python3 -m pip install pillow\`). ${detail}`);
    process.exit(1);
  }
};
const hash = () => Object.fromEntries(py(['scripts/build-brand-assets.py', '--digest'])
  .trim().split('\n').filter(Boolean).map((l) => l.split(' ') as [string, string]));
const before = hash();
py(['scripts/build-brand-assets.py']);
const after = hash();
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { console.error('FAIL not reproducible: ' + k); code = 1; }
}
if (!code) console.log(`PASS ${WANT.length} runtime assets derive from a master at 2x, reproducibly, none orphaned`);
process.exitCode = code;
