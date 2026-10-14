# ZZ Stack

The console of [zz-stack](https://github.com/zhixuan312/zz-stack): every team's work, knowledge and
telemetry in one place. It is called ZZ Stack, the platform's own name, because the two ship as one set.

Built on [ZZ Meridian](https://github.com/zhixuan312/zz-meridian), a dashboard design system:
DTCG tokens in `tokens/`, four layers of components in `src/components/`, dark first with a light
theme, and the `brand` accent from the brand purple. The console's own compositions are in
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
   (session, data)    (HTML and JS, and one read of who is asking)
```

**For every page, this app's server makes one read, and makes it as the person.** Before a
page renders, its gate asks the gateway `/me` (`gate` in `src/data/access.ts`), and that one
answer, read once per request, decides whether the page may render and which destinations
the rail and the command palette draw. `src/data/gateway.ts` sends the caller's own
`zz_console` cookie, that cookie alone, to the gateway that issued it, and stores nothing.
A page's own content is still read in the browser, against `/api/console` on the same
origin, carrying the person's own HttpOnly session cookie.

**So `ZZ_GATEWAY` is required for every page.** It is the address this app's server reads
the gateway at. Without it no page opens: each one says the console cannot reach the
platform, and offers a retry.

**The assistant reads through the same module, and it is off until it is configured.** Its
route has to know who is asking before a model is reached, and looks records up while it
writes a reply, as the person. See [The assistant](#the-assistant).

Same origin is what makes that work: the cookie is a plain first-party cookie, so there
is no CORS, no preflight and no third-party-cookie behaviour to design around.

**A page stays fresh without being polled.** Each tab follows one Server-Sent Events stream,
`/api/console/live` on the same origin, which carries hints and never data: *the `teams`
collection changed, and it is this team's business*. The tab then reads that collection again
through the same authorized read it used on load. A missed hint costs freshness and never
correctness — the client polls as a safety net, and resyncs every time the stream reopens — and
what crosses the wire is a team and a collection name, never a row, a record or a cache tag.
A page says in one line which collections it shows (`useLive([...])`); the per-page READMEs
say which, and why.

The stream is the gateway's (`services/gateway/src/console/live.ts` in zz-stack, with a database
trigger raising each hint inside the writer's own transaction). Against a gateway older than
0.95.0 the stream never opens and the console falls back to that poll — 30 seconds instead of a
moment, and nothing else changes.

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

Locally there is no gateway to ask who is signing in, so every page says the console cannot
reach the platform. That is deliberate: the console has no offline mode, and fixtures that
drift from the real API are worse than an honest failure. `pnpm verify` runs it against the
fake gateway instead (`scripts/fake-gateway/`).

### Against real data

Set `ZZ_GATEWAY` and the server asks that gateway who is signing in for every page, and
`next dev` routes `/api/console/*` and `/auth/*` to it — the same split Caddy performs in
production, in the one place a laptop has to do it itself. Unset, no page opens, exactly as
described above.

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

A dev-PAT session reads everything a browser session reads but is **not offered Approve**: an
approval rests on a presentation the person's own console session recorded (`x-zz-via: session`),
and a PAT is not a console session. Approve from a real browser sign-in.

The token is attached only when `ZZ_DEV_PAT` is set, and never when
`NODE_ENV === 'production'`; the server's own read of `/me` (`src/data/gateway.ts`) sends the
same token under the same guard. It forwards a credential and neither mints nor stores one.
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
pnpm verify           # the gate, a build against the fake gateway, the route and size checks
pnpm verify --full    # the whole standard: the audit, the presses, the keyboard path, Web Vitals
```

**`--full` is the whole standard, and the two depths are not interchangeable.** The default
stops after the static checks and a three-route navigation smoke — about 40 s. `--full` builds
the console against `scripts/fake-gateway/` (synthetic records, writes accepted and forgotten)
because its presses approve, revoke and archive whatever a page offers, then audits every page at
five widths in both themes, presses every control, walks the whole keyboard path
(`scripts/keyboard.ts`), and runs the product's own browser checks: the Approve banners a page load
cannot reach (`scripts/approve-banners.ts`), that a change made anywhere reaches the page a person
is looking at (`scripts/live-check.ts`), that a control showing a selection shows the one that
was pressed (`scripts/selection-check.ts`), and that no page disagrees with its own server HTML
when the main thread is slow enough for its reads to answer before it hydrates
(`scripts/hydration-check.ts`). Then LCP, INP and CLS on a mid-range phone — about 22 minutes.

**Which depth CI runs is `.github/workflows/gate.yml`, and it runs `--full`.** It did not always: the
workflow ran the shallow default for its whole life while its own comment described the deep one, so
CI was green while the deep standard was red — six document routes sat above the LCP bar for a day
of work before anything said so, and the only thing that ever said so was running the real thing by
hand. Read the coverage line at the end of `out/verify.txt` before believing any pass, in CI or
locally: it names every suite that did not run, and a check that did not run reads exactly like one
that passed.

What each suite checks beyond the static routes, and against what, is in
`scripts/verify.config.ts`. The report is `out/verify.txt`.

## The assistant

A panel in the shell that reads the page a person is on, answers about it from the
platform's own records, and changes nothing. It is Meridian's assistant, mounted the way
Meridian's guide describes; `docs/brief.md` records what this console decided about it.

It is off until the four `ASSISTANT_*` variables are set, read from the environment on every
request, so one build serves both. With none set there is no launcher, no panel and no Ask,
and `POST /api/assistant` answers 404. It also reads through `ZZ_GATEWAY`, which every page
already needs. `.env.example` lists them.

| Variable | Meaning |
|---|---|
| `ASSISTANT_PROVIDER` | `anthropic`, or `openai-compatible` for any service that speaks the OpenAI chat-completions format |
| `ASSISTANT_API_KEY` | The provider's key. It never reaches the browser |
| `ASSISTANT_MODEL` | The model's id, exactly as the provider lists it. It must be able to call tools |
| `ASSISTANT_BASE_URL` | The provider's address. Required for `openai-compatible` |
| `ZZ_GATEWAY` | Where this app's server reaches the gateway. Required for every page, not only the assistant: see [How it fits together](#how-it-fits-together) |

What it reads:

- **The page.** Every console page shares a context (`src/views/*-context.ts`): its scope,
  how fresh the data is, each figure with its definition, what code computed from them,
  and what the data cannot say. Each page's `README.md` says what its context holds.
- **The records.** One read-only collection per list (`src/data/collections.ts`), each the
  same gateway route its page reads, as the person asking: `query_teams`,
  `query_initiatives`, `query_knowledge` and the rest.
- **Another view.** One `view_<name>` tool per page (`src/views/tools.ts`), which opens
  that view at an address and returns the same context the page would share.
- **What documents say.** `view_search` is the platform's own ranked search, run as the
  person: the text of every document and knowledge node they may read, each result a
  matched excerpt with the address of its page. Every other tool reads titles, states and
  counts; this is the one that reads content.

What it may do: read what the person may read, and nothing else. A member is offered the
lists the rail shows a member; the gateway scopes every read whatever the assistant asks.
No tool writes. A person approves a document, issues a token and changes a team on the
page, as before.

Each question is sent to the model provider with the page's text, its context and the
Product, Users and Glossary sections of `docs/brief.md`, so none of those may hold a
secret. The thread stays in the browser's local storage; Settings has the person's own
switch for the panel.

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

`ZZ_GATEWAY` must be set in the `.env` beside the compose file, to the gateway's public
address (`https://api.<host>`): the gateway is published on the host's loopback, which the
console's container cannot reach. Compose refuses to start the console without it.

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
| **Knowledge** | The nodes, with the whole body open beside the list, and the store's log of every node recorded or retired |
| **Plugins** | What a person installs; open one and it leads with its overall evaluation score, then the evidence behind it — health, quality by dimension, usage, findings, candidates and releases (one compact panel until a run has completed), and who may change it |
| **Runs** | Every run by the skill that drove it |
| **Activity** | The audit log |
| **People** | Everyone the platform knows, and what they can reach |

Statistics come before judgment on every analysis page, because a score with no idea what
it cost to produce is a number nobody can act on.
