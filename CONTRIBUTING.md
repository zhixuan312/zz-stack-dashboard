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
pnpm test                 # vitest, 151 tests
pnpm gate                 # this repo's own gate — run it last
```

`pnpm gate` is the one worth knowing about. It is six checks, and like the platform's they
are written as properties rather than test names — *"a timestamp is rendered through
`<Time>`"*, *"no map is keyed by the names of one flow, block or skill"*. They exist because each one
encodes something that broke here once. A red gate is never bypassed: if a check is wrong, fix
the check and say in its comment what it was wrong about.

## Where things are

```
app/         Next routes. (dash)/ is everything behind the passkey.
src/         components, hooks and lib — the parts a route composes.
tests/       vitest, colocated by subject rather than by file.
scripts/     gate.ts and the two design audits.
docs/        written for somebody who does not work on this every day.
```

## House rules

- **Dates and times go through `<Time>`.** Not `toLocaleString`, not a raw ISO string. A
  reader eight hours from the server read 04:43 when it was 12:43 for them, on every label,
  and the gate now refuses the direct call.
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
CONTRIBUTING.md carries the same rule and the measurements behind it; this console's own
checks in `checks/` read source text too, so run them after a comment sweep.

## Releasing

The console is released by **zz-stack's** `scripts/release.ts`, as its own component with its
own version and its own published image. It is not released from here, and it is not built on
the host: `docker-compose.yml` names a published image and that file is the only thing that
reaches a server.
