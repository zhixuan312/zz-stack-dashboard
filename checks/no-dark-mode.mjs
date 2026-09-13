// A half-removed theme is worse than either keeping or removing it: the tokens resolve in
// some places and not others, and the result looks like a rendering bug rather than a choice.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
/* FOUR SPELLINGS OF THE MACHINERY, and one of the RULE itself.
 *
 * The first four are the plumbing that used to exist here and is now deleted. The fifth,
 * `dark:`, is the one a person adds by reflex months from now — Tailwind's dark variant
 * compiles happily against a project with no dark mode and emits a rule that can never
 * match, so the element silently keeps its light styling and the author believes they
 * shipped a dark treatment. A mutation test put `dark:bg-black` in the rail and this
 * check passed; it was looking for the removal and not for the rule.
 *
 * Matched with a word boundary so `dark:` is caught and the words "dark mode" in a
 * comment recording WHY it was removed are not — that history is worth keeping, and a
 * check that forbids describing its own reason teaches people to delete the reason. */
const BANNED = /prefers-color-scheme|data-theme|ThemeToggle|AppearancePanel|(?:^|[\s"'`:])dark:[a-z[]/;
const EXT = new Set(['.ts', '.tsx', '.css']);
let code = 0;
const walk = (dir) => {
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
