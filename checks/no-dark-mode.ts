// The console has no dark mode: neither its machinery nor a Tailwind dark variant may appear
// under app/ or src/.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
/* Four spellings of the machinery, and one of the rule itself.
 *
 * The fifth is Tailwind's dark variant, which compiles happily against a project with no dark
 * mode and emits a rule that can never match, so the element keeps its light styling while
 * the author believes they shipped a dark treatment.
 *
 * DELIBERATE: the variant is matched with a leading boundary and a following letter, so the
 * words "dark mode" in prose are not caught. A check that forbids describing its own reason
 * teaches people to delete the reason. */
const BANNED = /prefers-color-scheme|data-theme|ThemeToggle|AppearancePanel|(?:^|[\s"'`:])dark:[a-z[]/;
const EXT = new Set(['.ts', '.tsx', '.css']);
let code = 0;
const walk = (dir: string): void => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!EXT.has(p.slice(p.lastIndexOf('.')))) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (BANNED.test(line)) { console.error(`FAIL ${p}:${i + 1} ${line.trim().slice(0, 70)}`); code = 1; }
    });
  }
};
walk('app'); walk('src');
for (const gone of ['src/components/ui/theme-toggle.tsx', 'src/components/settings/AppearancePanel.tsx']) {
  if (existsSync(gone)) { console.error('FAIL still present: ' + gone); code = 1; }
}
const css = readFileSync('app/globals.css', 'utf8');
for (const keep of ['--on-accent', '--on-danger']) {
  if (!css.includes(keep)) { console.error('FAIL ' + keep + ' was deleted; it must be retained'); code = 1; }
}
if (!code) console.log('PASS dark mode is completely gone, on-accent tokens retained');
process.exitCode = code;
