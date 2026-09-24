/* Which artwork each surface carries, per the mascot mapping — not merely that a mascot is
 * present. Eight illustrations that all mean "something happened" tell the reader the product
 * is not reading the situation either.
 *
 * Two halves, because the assignments live in two shapes. Most are EmptyState call sites and
 * are checked exhaustively: every one must carry an assigned illustration and the total must
 * match. Four are one-off surfaces — a waiting screen, a success toast, the sign-out page,
 * the login hero — that are not EmptyStates, and each is pinned to its file by name.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* EmptyState surfaces: illustration -> the files the spec assigns it to. */
const WANT: Record<string, string[]> = {
  // `teams/page.tsx` is the teams list, whose search and status facet can match nothing — the
  // same "nothing matches" surface /initiatives has. `teams/[slug]/page.tsx` beside it is one
  // team's detail page, which is a different empty.
  'state-empty': ['knowledge/log/page.tsx', 'initiatives/page.tsx', 'teams/page.tsx', 'teams/[slug]/page.tsx', 'SkillCost.tsx', 'knowledge/page.tsx'],
  'state-welcome': ['TokensPanel.tsx', 'TeamMembersPanel.tsx', 'PlatformPeoplePanel.tsx'],
  'state-error': ['error.tsx', 'Query.tsx'],
  'state-notfound': ['not-found.tsx', 'plugins/[plugin]/page.tsx', 'plugins/[plugin]/[skill]/page.tsx', 'knowledge/page.tsx'],
};
const SITES = 15;

/* Non-EmptyState surfaces: illustration -> the one file that may carry it, and why. */
const ONE_OFF = {
  'state-thinking': ['src/components/KnowledgeAsk.tsx', 'waiting on an answer — the only spinner substitute'],
  'state-approved': ['src/components/ApproveAction.tsx', "the platform's signature act succeeding"],
  'state-goodbye': ['app/signed-out/page.tsx', 'signed out'],
  'mascot-hero': ['app/login/page.tsx', 'the login hero'],
};

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
};

let code = 0, sites = 0;
const files = [...walk('app'), ...walk('src')];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const n = (src.match(/<EmptyState/g) || []).length;
  if (!n) continue;
  sites += n;
  const assets = Object.keys(WANT).filter((a) => src.includes(a));
  if (!assets.length) { console.error('FAIL ' + f + ' has an EmptyState with no illustration'); code = 1; continue; }
  for (const asset of assets) {
    if (!WANT[asset].some((s: string) => f.endsWith(s))) {
      console.error(`FAIL ${f} uses ${asset}, which the spec does not assign to it`); code = 1;
    }
  }
}
if (sites !== SITES) { console.error(`FAIL found ${sites} EmptyState call sites, expected ${SITES}`); code = 1; }

for (const [asset, [owner, why]] of Object.entries(ONE_OFF)) {
  const users = files.filter((f) => readFileSync(f, 'utf8').includes(asset));
  if (!users.includes(owner)) {
    console.error(`FAIL ${asset} is not used by ${owner} (${why})`); code = 1;
  }
  for (const u of users) {
    if (u !== owner) { console.error(`FAIL ${asset} is assigned to ${owner} only, but ${u} uses it too`); code = 1; }
  }
}

/* The root 404, which is not an EmptyState. Without app/not-found.tsx, Next serves its own
 * black default. */
const root = 'app/not-found.tsx';
if (!files.includes(root)) {
  fail404('the root 404 does not exist — Next will serve its black built-in default');
} else if (!readFileSync(root, 'utf8').includes('state-notfound')) {
  fail404('the root 404 carries no mascot');
}
function fail404(m: string): void { console.error('FAIL ' + m); code = 1; }

if (!code) {
  console.log(`PASS ${sites} EmptyState sites carry their assigned illustration; 4 one-off surfaces and the root 404 pinned`);
}
process.exitCode = code;
