# Contributing

This is the admin console for [zz-stack](https://github.com/zhixuan312/zz-stack) — a Next.js
app that talks to the platform's `/api/console/*` routes. It has no database of its own and no
server-side platform logic: everything it shows comes from the gateway, behind a passkey.

## Getting it running

```bash
pnpm install
pnpm dev                  # against a gateway you can reach
```

```bash
pnpm test:t1       # the Tier 1 tests affected by changes since the last green run
pnpm test:t2       # the affected Tier 2 tests plus the affected Tier 1 tests
pnpm test:release  # every Tier 1 and Tier 2 test, plus lint and type check; before a release
```

Three commands, no arguments. The runner picks the tests; do not narrow a run by hand. `test:t1`
runs the static checks and then Vitest's related selection over the files changed since the last
green run (`out/last-green`, gitignored). Tier 1 is every test under `tests/` except
`*.perf.test.*`; Tier 2 is that convention plus the timed browser suite. `test:t2` includes the
affected Tier 2 files and runs the timed suite when a change reaches shared components, the shell,
views, logic, the data layer, styles or tokens. `test:release` runs every test with lint, the type
check and the browser standard: at Tier 1 the audit, the presses, the keyboard walk, the assistant
walk-through and both persona walks; at Tier 2 the timed suites. It is the run before a release,
and without Chrome it reports the browser standard not run, never passed.

On every push CI runs `pnpm test:release` (`.github/workflows/gate.yml`); the weekly perf job runs
`pnpm test:t2` (`.github/workflows/weekly.yml`).

The specification checks
(`scripts/check.ts` and `scripts/check.local.ts`) hold Meridian's rules and the console's own,
written as properties rather than test names: *"a timestamp is never printed raw"*, *"no map is
keyed by the names of one flow or skill"*, *"markdown renders raw HTML inert"*. A red gate is
never bypassed: if a check is wrong, fix the check and say in its comment what it was wrong about.

## Where things are

```
app/              Next routes. (dash)/ is everything behind the passkey; each has a README spec.
src/components/   Meridian's components and patterns. Extend them; do not fork a second look.
src/console/      the console's own compositions: the frame, the page, panels, tables.
src/data/         the one place the gateway is touched, on the console's server: reads, access, prepared collections.
src/logic/        every figure and sentence with a product definition: page contexts, filters, view tools.
src/views/        what draws: the page components, the chrome, the live glue.
src/lib/          shared helpers: the browser's fetch (api, mutate), the payload shapes and the formatters.
tokens/           Meridian's DTCG tokens; `pnpm tokens` after a change.
tests/            vitest, colocated by subject rather than by file.
scripts/          the test runner and the browser standard (the audit, the walks, the timed suites), and the fake gateway they run against.
docs/brief.md     the decisions behind the move to Meridian.
```

## House rules

- **Dates and times go through `<When>` or `src/lib/format-date`.** Not `toLocaleString`, not
  a raw ISO string: a raw time is off by the reader's distance from the server, and the gate
  refuses one printed into a cell.
- **A colour is a role, a size is on Meridian's scale.** `check.ts` fails on a literal colour or
  a Tailwind default utility; both render nothing or the wrong thing in one of the two themes.
- **No flow's stage names in a map key.** A component keyed on one flow's stages silently
  shows nothing for the next flow. The gate checks this too.
- **Branches are `master` or `release/<version>`.** Nothing else.
- **No backward-compatibility scaffolding** — change it and say what broke.
- The version and its compose literal move together; the platform's release script bumps both.

### Comments are read by agents

The reader is a coding agent, not a person skimming. State the rule first, then at most one
clause of why. Drop what only serves a human reader — capitals for emphasis, the same point
made three ways, narrative build-up, persuasion.

Never drop a coupling (name the file or symbol that has to move with this one), a closed set
the code depends on being closed, or a measured number the rule needs to be credible.

Two prefixes, because an agent greps before it edits:

- `DELIBERATE:` — this looks wrong and is not. Do not "fix" it.
- `COUPLED:` — editing here requires editing there. Name the there.

`grep -rn "DELIBERATE:\|COUPLED:"` a directory before changing anything in it. zz-stack's
CONTRIBUTING.md carries the same rule; `node scripts/check.ts` reads source text too, so run it
after a comment sweep.

## Releasing

The console is released by **zz-stack's** `scripts/release.ts`, as its own component with its
own version and its own published image. It is not released from here, and it is not built on
the host: `docker-compose.yml` names a published image and that file is the only thing that
reaches a server.
