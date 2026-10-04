# ZZ Stack

The console of [zz-stack](https://github.com/zhixuan312/zz-stack): every team's work, knowledge and
telemetry in one place. It is called ZZ Stack, the platform's own name, because the two ship as one set.

Built on [ZZ Meridian](https://github.com/zhixuan312/zz-meridian), a dashboard design system:
DTCG tokens in `tokens/`, four layers of components in `src/components/`, dark first with a light
theme, and the `zz` accent from the brand purple. The console's own compositions are in
`src/console/`. `docs/brief.md` records the decisions; build up from Meridian's components and
tokens rather than inventing a second look.

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

Later ones come from the console, or from `enrolment_issue` on `/manage/mcp`.

**A credential is bound to the hostname in `CONSOLE_PUBLIC_URL`.** Change it and every
registered passkey stops verifying at once, and everybody re-enrols. Worth knowing before
you move a host, not after.

## Running it

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

Locally there is no gateway behind `/api/console`, so every page shows the error the
fetch actually produced. That is deliberate: the console has no offline mode, and
fixtures that drift from the real API are worse than an honest failure.

### Against real data

Set `ZZ_GATEWAY` and `next dev` routes `/api/console/*` and `/auth/*` to that gateway —
the same split Caddy performs in production, in the one place a laptop has to do it
itself. Unset, there is no rewrite and a local call fails exactly as described above.

```sh
echo 'ZZ_GATEWAY=https://api.<your-host>' >> .env.local
pnpm dev
```

That gets the API to answer. The other half is identity, and there are two ways to
supply it — one automatic, one manual.

#### A superadmin PAT (what to use)

```sh
echo "ZZ_DEV_PAT=$(cat ~/.zz/token)" >> .env.local   # must be a superadmin token
pnpm dev
```

`proxy.ts` attaches it as `Authorization: Bearer …` on `/api/console/*` and `/auth/*`,
and drops any stale `zz_console` cookie so the gateway reads the token rather than refusing
on the cookie. Real data, no browser ceremony, nothing to redo when a session expires.

This is not a workaround. `mayReadConsole()` in the gateway
(`services/gateway/src/console/shared.ts`) reads:

```ts
if (id.via === "session") return true;   // signed in through the browser
return isSuper(id);                      // or a superadmin PAT, for scripts
```

A **member** PAT authenticates and is then refused with *"the console needs a browser
sign-in"* and `mayRead: false`, which is correct.

The proxy is inert unless `ZZ_DEV_PAT` is set, and returns immediately when
`NODE_ENV === 'production'`. It forwards a credential and neither mints nor stores one.
`.env.local` is gitignored; keep it `chmod 600` and treat the value as the live credential
it is.

#### Carrying a browser session (the manual fallback)

**Sign-in is a passkey**, and a passkey is bound to the RP ID it was registered against, so
a credential created on the deployed console cannot be replayed from `localhost` — there is
no flag that changes this, and a tunnel does not help either, because `passkey.ts` pins
`expectedOrigin` to the gateway's own origin and fails an ngrok or nip.io host one step
later.

What works is carrying the session you already have:

1. sign in to the deployed console in the browser, as normal;
2. copy the value of the `zz_console` cookie (DevTools -> Application -> Cookies);
3. add a cookie of the same name and value on `http://localhost:3000`, path `/`;
4. reload.

`Secure` cookies are permitted on `http://localhost`, so the flag is not in the way. Treat
that cookie as the live credential it is: it is a signed-in session for a real deployment,
and it belongs in a browser profile rather than in a file, a shell history or this
repository.

```sh
pnpm build && pnpm start     # production build
pnpm typecheck && pnpm lint && pnpm test && pnpm gate   # what the release runs
```

Those four, in that order, are what `zz-stack/scripts/release.ts` runs against this
repo before it will build an image, so they are the real bar.

`pnpm gate` is Meridian's: tokens are fresh, the specifications are consistent (every
colour a role, every utility on Meridian's scales, no dormant export, markdown renders raw HTML
inert), the console's own rules hold (`scripts/check.local.ts`: no raw timestamp, no hardcoded
denominator, an empty hand-built table says so, no source file over 700 lines), contrast holds
for every pair in both themes and every accent, then route types, lint, types and tests.

```sh
pnpm verify    # the gate, a build against the fake gateway, the browser checks, Web Vitals
```

`pnpm verify` is the whole standard and what CI runs. It builds the console against
`scripts/fake-gateway/` (synthetic records, writes accepted and forgotten) because its presses
approve, revoke and archive whatever a page offers, then audits every page at five widths in
both themes, presses every control, walks the whole keyboard path (`scripts/keyboard.ts`), and
measures LCP, INP and CLS on a mid-range phone. What it checks beyond the static routes, and
against what, is in `scripts/verify.config.ts`. The report is `out/verify.txt`.

## Deploying

**Released by zz-stack, not by hand.** The console is one of two components in a platform
release — `zz-stack/scripts/release.ts <platform-version> --dashboard=<console-version>` —
which runs this repo's `typecheck`, `lint` and `test`, bumps `package.json` and the compose
literal together, builds and pushes `ghcr.io/zhixuan312/zz-stack-dashboard`, copies
`docker-compose.yml` to the host, and rolls it back with the platform if verification fails.
See `/release` in the parent checkout.

On the host, then, the whole deployment is one file and one image:

```sh
docker compose up -d          # pulls ghcr.io/zhixuan312/zz-stack-dashboard:<literal>
```

Binds to `127.0.0.1:3100`. Caddy on the host is the only way in and is what splits the
path — see the site block in zz-stack's `deploy/Caddyfile`.

To run the container from this checkout instead of the published image:

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## The pages

| | |
|---|---|
| **Overview** | Tool calls over the period, stacked by whether they ran inside a run, outside one or were refused, beside three tiles: initiatives progressing, knowledge from work, context per run. Then the gates waiting on a person and open work by stage, then where refusals come from and event kinds |
| **Teams** | Every team and what it holds — documents, sources, knowledge nodes; open one for its initiatives and members. Switching here moves **this browser's session only**: your agents keep acting for the team `team_switch` on `/manage` set |
| **Initiatives** | Every piece of work and how far through its flow it got |
| **Knowledge** | The nodes, with the whole body open beside the list; Ask the store a question, or read its log of every node recorded or retired |
| **Plugins** | What a person installs; open one and it leads with its overall evaluation score, then the evidence behind it — health, quality by dimension, usage, findings, candidates and releases (one compact panel until a run has completed), and who may change it |
| **Runs** | Every run by the skill that drove it |
| **Activity** | The audit log |
| **People** | Everyone the platform knows, and what they can reach |

Statistics come before judgment on every analysis page, because a score with no idea what
it cost to produce is a number nobody can act on.
