# ZZ Console

The superadmin dashboard for [zz-stack](https://github.com/zhixuan312/zz-stack): every
team's work, knowledge and telemetry in one place.

Built on the
[multi-model-agent-dashboard-template](https://github.com/zhixuan312/multi-model-agent-dashboard-template)
design system — one neutral ramp, one accent, three reserved status hues, seven type
sizes. `docs/DESIGN-SYSTEM.md` is the contract; follow it rather than inventing a
second look.

## How it fits together

```
   browser
      │  one origin: console.<host>.nip.io
      ▼
   Caddy ──────────────┬───────────────────────────────────
      │ /auth/*        │ everything else
      │ /api/console/* │
      ▼                ▼
   zz-stack gateway   this app
   (session, data)    (HTML and JS, nothing else)
```

**This app holds no credential and calls nothing.** Every read happens in the browser
against `/api/console` on the same origin, carrying the person's own HttpOnly session
cookie. If the Next server fetched the API instead it would have to take that cookie out
of the request and replay it upstream — which is the "a proxy forwards the caller's
credentials" shape zz-stack forbids and has a gate check for. Keeping the fetches in the
browser means this container is a renderer and nothing more.

Same origin is what makes that work: the cookie is a plain first-party cookie, so there
is no CORS, no preflight and no third-party-cookie behaviour to design around.

## Signing in

**A passkey, and nothing else.** The gateway owns it —
`services/gateway/src/passkey.ts` in zz-stack, serving `/auth/*` — and there is no
password, no directory federation and no secret to rotate.

The one setting is `CONSOLE_PUBLIC_URL`, and it is the whole relying party: its hostname
becomes the RP ID and its origin the expected origin, both derived from that single value
so the two cannot be spelled apart. It is never taken from the `Host` header, because the
one value worth forging is exactly the one that must not come from the request. Unset, the
gateway answers 503 and says so rather than guessing.

**Nobody registers themselves.** A principal is created first, then a superadmin mints a
one-time enrolment link for it. The first one comes from the host, because before anyone
holds a passkey there is no superadmin session to mint it with:

```sh
./issue-enrolment.sh someone@example.com     # on the host, from deploy/
```

Later ones come from the console, or from `issue_enrolment` on `/manage/mcp`.

**A credential is bound to the hostname in `CONSOLE_PUBLIC_URL`.** Change it and every
registered passkey stops verifying at once, and everybody re-enrols. Worth knowing before
you move a host, not after.

> This section described directory sign-in through SsoAuth until 2026-09-11, naming a module
> and environment variables that are not in the tree. An operator following it would have set
> values nothing reads, and registered a callback for a flow that does not exist.

## Running it

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

Locally there is no gateway behind `/api/console`, so every page shows the error the
fetch actually produced. That is deliberate: the console has no offline mode, and
fixtures that drift from the real API are worse than an honest failure. To work against
real data, run it behind the same Caddy split, or tunnel the gateway to `localhost:3000`
under the `/api` path.

```sh
pnpm build && pnpm start     # production build
pnpm typecheck && pnpm lint && pnpm test && pnpm gate   # what the release runs
```

Those four, in that order, are what `zz-stack/scripts/release.mjs` runs against this
repo before it will build an image — so they are the real bar, and `pnpm gate` is one
of them rather than a superset. The gate does not run the other three (it ends in
`next build`, which type-checks but runs no tests).

What the gate adds on top is the house rules — a timestamp rendered through `<Time>`,
a table that can be empty saying so, no source file over 700 lines — plus **the
contrast floor**, 31 enumerated token pairs exiting non-zero, plus every check under
`checks/`: one mark, one sparkle, no dark mode, the kit's chart cycle, the mascot
assignments, asset custody, and the counts in `docs/DESIGN-SYSTEM.md`.

```sh
pnpm checks           # the 17 design-system checks, named, with a count
pnpm verify:contrast  # the 31 pairs on their own
pnpm audit:design     # discipline counters — advisory, does not gate
```

The first two are in `pnpm gate` and need no separate run; they are listed because
when the gate goes red it is quicker to run the one that failed.

## Deploying

**Released by zz-stack, not by hand.** The console is one of three components in a platform
release — `zz-stack/scripts/release.mjs <platform-version> --dashboard=<console-version>` —
which runs this repo's `typecheck`, `lint` and `test`, bumps `package.json` and the compose
literal together, builds and pushes `ghcr.io/zhixuan312/zz-stack-dashboard`, copies
`docker-compose.yml` to the host, and rolls it back with the platform if verification fails.
See `/release` in the parent checkout.

The reason it is not deployed by hand: for a while it was, by rsyncing this source tree and
building on the host, and that is how production stopped running published images without
anybody deciding to.

On the host, then, the whole deployment is one file and one image:

```sh
docker compose up -d          # pulls ghcr.io/zhixuan312/zz-stack-dashboard:<literal>
```

Binds to `127.0.0.1:3100`. Caddy on the host is the only way in and is what splits the
path — see the site block in zz-stack's `deploy/Caddyfile`.

To run the container from THIS checkout instead of the published image:

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## The pages

| | |
|---|---|
| **Overview** | Four questions first — is work progressing, is what we write down worth reading, is the tool surface breaking, is the system straining — then counts, events per day and the most-refused calls |
| **Teams** | Every team; open one for its initiatives, members, flows and block connections |
| **Initiatives** | Every piece of work and how far through the seven steps it got |
| **Knowledge** | The nodes, with the whole body open beside the list |
| **Skills & evals** | Each skill in six steps: what it is, what it costs, how it is judged, what it scored, what was found, what to conclude |
| **Runs** | Every run by the skill that drove it |
| **Blocks** | One block at a time, never averaged — refusals split by who has to fix them |
| **Activity** | The audit log |
| **People** | Principals, tokens, and delegated block connections |

Statistics come before judgment on every analysis page, because a score with no idea what
it cost to produce is a number nobody can act on.
