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
pnpm typecheck            # tsc --noEmit
pnpm lint                 # eslint
pnpm test                 # vitest
pnpm gate                 # Meridian's gate: tokens, specifications, contrast, types, tests
pnpm verify               # the gate, a build against the fake gateway, the browser audit, every control pressed
```

`pnpm verify` is the whole standard and what CI runs. The specification check
(`scripts/check.ts`) holds Meridian's rules and the console's own, written as properties
rather than test names: *"a timestamp is never printed raw"*, *"no map is keyed by the names
of one flow or skill"*, *"markdown renders raw HTML inert"*. A red gate is never bypassed: if a
check is wrong, fix the check and say in its comment what it was wrong about.

## Where things are

```
app/              Next routes. (dash)/ is everything behind the passkey; each has a README spec.
src/components/   Meridian's components and patterns. Extend them; do not fork a second look.
src/console/      the console's own compositions: the frame, the page, panels, tables.
src/lib/          the data layer (api, mutate, api-shapes) and the formatters.
tokens/           Meridian's DTCG tokens; `pnpm tokens` after a change.
tests/            vitest, colocated by subject rather than by file.
scripts/          Meridian's gate, audit and verify, and the fake gateway they run against.
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
