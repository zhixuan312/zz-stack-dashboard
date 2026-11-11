<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:zz-meridian-agent-rules -->
# Built on ZZ Meridian 0.39.0

Follow the zz-meridian skill in `.agents/skills/zz-meridian/SKILL.md`.
Read `optional:docs/brief.md` for this team's product, users, data and decisions.
When it is absent, use the skill's brief template with the person's answers; do not invent product facts.

- What is yours: product pages, data, other team files, `src/app.config.ts` and `scripts/verify.config.ts`.
  Managed paths are recorded in `.meridian/manifest.json`; declared kept divergences are in
  `optional:.meridian/keep.json`. Explicit shared-file operations are described by the skill.
- Extend rather than edit: follow `.agents/skills/zz-meridian/references/customize.md`.
- Update: follow `.agents/skills/zz-meridian/references/update.md`. Installed files do not mean a completed
  upgrade: resolve the report and run the pinned finalization command.
- Test runs, and the only test commands: `pnpm test:t1` (the Tier 1 tests affected since the last green run),
  `pnpm test:t2` (the affected Tier 2 tests too) and `pnpm test:release` (every Tier 1 and Tier 2 test, lint and the
  type check). The tool picks the tests; never name one. Label every plan phase Tier 1, 2 or 3: Tier 1 phases use
  `test:t1`, Tier 2 and Tier 3 phases use `test:t2`. A release in this repository is dispatching
  `.github/workflows/release.yml` from master; `test:release` passes before it.
- Agents in the product read through authorized collections and write only through an approved Proposal.
<!-- END:zz-meridian-agent-rules -->

## Test runs

Three commands, no arguments. The runner picks the tests; a person never chooses a subset by hand.

| Command | Runs |
| --- | --- |
| `pnpm test:t1` | The Tier 1 tests affected by changes since the last green run. |
| `pnpm test:t2` | The affected Tier 2 tests plus the affected Tier 1 tests. |
| `pnpm test:release` | Every Tier 1 and Tier 2 test, plus lint and type check. Once, before a release. |

Tier 1 is every test under `tests/` except `*.perf.test.*`, and `test:t1` proves what a change
touches: the static checks (the tokens, the page and card specifications, contrast), the type
check, eslint over the changed files, then Vitest's `related` over the files changed since the
last green run. That change set is the marker in `out/last-green` (gitignored), written after a
passing run; with no marker the run compares against `master`. A changed test file runs itself; a
document is matched to the tests that name it; a deleted source file, or a code change no test
reaches, runs the whole tier; a change no test names has nothing to prove. `tests/deep-*`, the
large browser-fixture tests, are Tier 1 by what they verify and run on their own, never inside the
main run; this repository has none.

Tier 2 is the `<name>.perf.test.*` convention and the browser suites. `test:t2` adds the affected
Tier 2 files and, when a change can alter what a page draws or a control does, the browser sweeps
(`node scripts/browser.ts --depth fn`: the audit of every page at every width, every control
pressed, every link followed, the keyboard walk, the assistant walk-through and the persona
walks). The 20-sample protocol (`--depth perf`) runs only where CI is true, in the weekly job.
A passing run advances the marker only when it covered every change: a `test:t1` run leaves it
alone while a Tier 2 check is pending, so `test:t2` is not skipped.

`test:release` adds lint over the whole repository, a production build, the route policy, the size
checks against the app that build serves, and the browser suites at `--depth fn,timed` — the timed
ones are navigation timing with its budgets judged, the live-data checks, the product's own
`timedChecks` and the vitals floors. Without Chrome the browser suites are reported not run, never
passed. On a fresh CI checkout (no marker, no diff) `test:t2` runs the whole Vitest tier and the
browser sweeps; the timed suites stay with `test:release`.

`test:t2` and `test:release` run with `ZZ_GATEWAY=http://127.0.0.1:3125`, set by the
`package.json` scripts. `next.config.ts` bakes the `/api/console` rewrite from `ZZ_GATEWAY` when
the app is built, and the browser stage builds before it starts the fake gateway, so the build
and the fake have to agree on one address up front: the fake gateway binds that port when the
variable is set and a random one otherwise. Two runs at once therefore collide on the port, and
the second says so.

**The standard from 2026-11-10: only Tier 1 blocks.** A Tier 1 failure fails the run. A Tier 2
performance result — the timed browser suites and the vitals, navigation timing and size budgets
they hold — is reported and compared against earlier releases; it never fails a run and never
blocks a release. A check that did not run is listed as "not run" with its reason and is never
counted as passed. A Tier 1 failure that passes on a retry with no cause found is reported as
flaky, not as a pass. CI is the evidence for a release.

Known Tier 2 item, not blocking and not being fixed now: six document routes measure LCP
2.64–2.73 s against the 2.5 s floor on CI, with INP, CLS and dropped frames inside budget —
`/initiatives/atlas/2026-09-28-search-relevance/spec.md` (2.73 s), its `plan.md` (2.70 s),
`/initiatives/atlas/2026-09-12-onboarding-revamp/review.md` (2.66 s),
`/initiatives/atlas/2026-10-02-query-latency/spec.md` (2.67 s),
`/initiatives/atlas/2026-10-04-index-rebuild/spec.md` (2.64 s) and
`/plugins/sdlc/sdlc-spec?view=read` (2.69 s). The 141 KiB markdown renderer (react-markdown +
remark-gfm) is lazy-loaded to keep those routes under the 820 KiB first-load cap, so the body is
in hand at about 350 ms while the formatted first paragraph — the LCP element — waits for the
chunk. The fix, when it is scheduled, is to render the body on the server: `Prose` has no
`'use client'`, so the 141 KiB never ships.

The 20-sample navigation protocol (`node scripts/perf.ts`, `--depth perf` in the browser suite)
runs only where CI is true: the weekly job calls `pnpm test:t2` on a fresh clone, and a local run
reports it not run rather than judging the machine.

**A release in this repository is an image tag deployed by zz-stack's release** (`node
scripts/release.ts <version> --dashboard=<version>` in the zz-stack checkout). Pushing to
`master` is not a release: CI runs `test:release` on every push.

Every SDLC plan phase is labelled Tier 1, 2 or 3. Tier 1 phases use `test:t1`; Tier 2 and Tier 3
phases use `test:t2`. "Before delivery" in a plan means `test:release`.

