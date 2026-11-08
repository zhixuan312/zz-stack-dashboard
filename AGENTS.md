<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:zz-meridian-agent-rules -->
# Built on ZZ Meridian 0.36.0

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
  `test:t1`, Tier 2 and Tier 3 phases use `test:t2`. A release in this repository is an image tag deployed by
  zz-stack's release; `test:release` passes before it.
- Agents in the product read through authorized collections and write only through an approved Proposal.
<!-- END:zz-meridian-agent-rules -->

## Test runs

Three commands, no arguments. The runner picks the tests; a person never chooses a subset by hand.

| Command | Runs |
| --- | --- |
| `pnpm test:t1` | The Tier 1 tests affected by changes since the last green run. |
| `pnpm test:t2` | The affected Tier 2 tests plus the affected Tier 1 tests. |
| `pnpm test:release` | Every Tier 1 and Tier 2 test, plus lint and type check. Once, before a release. |

Tier 1 is every test under `tests/` except `*.perf.test.*`. `test:t1` runs the static checks and
then Vitest's related selection over the files changed since the last green run, recorded in
`out/last-green` (gitignored). A changed test file runs itself; a code path that reaches no test
runs the whole Tier 1 set; with no marker the run compares against `master`. Tier 2 is the
`<name>.perf.test.*` convention, which `test:t2` includes; with no such file here, `test:t2` runs
exactly the affected Tier 1 tests. `test:release` adds the type check, lint, the build, the route
policy and the size checks, and writes the marker on success. The browser audits and walks are
diagnostics, not tiers: run `node scripts/audit.ts`, `scripts/interactions.ts`,
`scripts/keyboard.ts`, `scripts/vitals.ts` directly when a change needs
them.

**A release in this repository is an image tag deployed by zz-stack's release** (`node
scripts/release.ts <version> --dashboard=<version>` in the zz-stack checkout). Pushing to
`master` is not a release: CI runs `test:release` on every push.

Every SDLC plan phase is labelled Tier 1, 2 or 3. Tier 1 phases use `test:t1`; Tier 2 and Tier 3
phases use `test:t2`. "Before delivery" in a plan means `test:release`.

