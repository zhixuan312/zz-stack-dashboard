/* DELIBERATE: `icon` stays required and the toast keeps its default branch. Both "helpful"
 * refactors compile. An optional `icon` allows an EmptyState with neither icon nor
 * illustration, and the icon is the fallback when the image fails to load. Changing the
 * toast's default branch restyles every caller to express a decision about one.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
let code = 0;
const es = readFileSync('src/components/ui/empty-state.tsx', 'utf8');
const ts = readFileSync('src/components/ui/toast.tsx', 'utf8');
if (!/illustration\?:/.test(es)) { console.error('FAIL EmptyState has no optional illustration'); code = 1; }
if (/icon\?:/.test(es)) { console.error('FAIL EmptyState made icon optional; it must stay required'); code = 1; }
if (!/\bicon:\s*ReactNode/.test(es)) { console.error('FAIL EmptyState no longer requires icon'); code = 1; }
if (!/illustration\?:/.test(ts)) { console.error('FAIL ToastItem has no optional illustration'); code = 1; }
if (!/CheckCircle2/.test(ts)) { console.error('FAIL the default success icon was removed; 36 callers rely on it'); code = 1; }
if (!/XCircle/.test(ts)) { console.error('FAIL the default error icon was removed'); code = 1; }
/* Decorative in both: the words beside them carry the meaning, and announcing it twice
 * is worse than not announcing it. */
for (const [name, src] of [['EmptyState', es], ['Toast', ts]]) {
  const img = src.match(/<Image[\s\S]*?\/>/);
  if (!img) { console.error(`FAIL ${name} renders no <Image> for the illustration`); code = 1; }
  else if (!/alt=""/.test(img[0])) { console.error(`FAIL ${name}'s illustration is not decorative`); code = 1; }
}
try { execFileSync('pnpm', ['run', 'typecheck'], { stdio: 'pipe', timeout: 300000 }); }
catch { console.error('FAIL typecheck: the change is not additive'); code = 1; }
if (!code) console.log('PASS both slots added, additively, decorative in both');
process.exitCode = code;
