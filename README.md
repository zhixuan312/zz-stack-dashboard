# ZZ Stack

The console of [zz-stack](https://github.com/zhixuan312/zz-stack): every team's work, knowledge and
telemetry in one place. It is called ZZ Stack, the platform's own name, because the two ship as one set.

Built on [ZZ Meridian](https://github.com/zhixuan312/zz-meridian), a dashboard design system:
DTCG tokens in `tokens/`, four layers of components in `src/components/`, dark first with a light
theme, and the `brand` accent from the brand purple. The console's own compositions are in
`src/console/`. `docs/brief.md` records the decisions; build up from Meridian's components and
tokens rather than inventing a second look.

Calendar dates use `src/lib/format-date.ts` and keep their stated year and day, including
years before 0100. `tests/calendar-years.test.ts` holds every calendar display formatter to that.

Pagination rendering tests reuse each page's fetched snapshot when checking a repeated render.
The fake gateway's live revision changes remain covered separately by `tests/fake-gateway-drift.test.ts`.

## How it fits together

```
   browser
      │  one origin: CONSOLE_PUBLIC_URL (zz-stack.com)
      ▼
   Caddy ──────────────┬───────────────────────────────────
      │ /auth/*        │ everything else
      │ /api/console/* │
      ▼                ▼
   zz-stack gateway   this app
   (session, data)    (HTML and JS, and each page's first read, as the person)
```

**For every page, this app's server reads the gateway, and reads it as the person.** Before a
page renders, its gate asks the gateway `/me` (`gate` in `src/console/gate.tsx`), and that one
answer, read once per request, decides whether the page may render and which destinations
the rail and the command palette draw. The page then makes its own first read there too, in
the read module beside its route (`read-home.ts`, `read-record.ts` and the rest), bounded at
4.5 seconds, so its content is in the first paint. Both go through `src/data/gateway.ts`, which
sends the caller's own `zz_console` cookie, that cookie alone, to the gateway that issued it,
and stores nothing. What a page reads after it is drawn, a Retry or a collection a live hint
names, is read in the browser, against `/api/console` on the same origin, carrying the
person's own HttpOnly session cookie.

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
say which, and why. Every console read answers with its collection's revision
(`x-zz-revision: <collection>:<boot>:<n>`, counted as the caller's own stream would be hinted), and a
page read on the console's server hands those revisions to `useLive`, so a stream opened for a page,
on a first load or after a press in the rail, asks whether anything moved since: it is greeted `synced`
and reads nothing again, or `resync` naming only what moved. Only a reopen after a gap (an error, a tab
shown again, the poll's retry) resyncs every name.

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
drift from the real API are worse than an honest failure. `pnpm test:release` runs it against the
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
`expectedOrigin` to the gateway's own origin and fails a tunnel host one step
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
pnpm test:release            # every Tier 1 and Tier 2 test, with lint and the type check
```

`pnpm test:release` is what `zz-stack/scripts/release.ts` runs against this repository
before it will build an image. It is also the whole testing standard; the three commands
are below.

## Checking it

Three commands, no arguments. The runner picks the tests; a person never chooses a subset by hand.

| Command | Runs |
| --- | --- |
| `pnpm test:t1` | The Tier 1 tests affected by changes since the last green run. |
| `pnpm test:t2` | The affected Tier 2 tests plus the affected Tier 1 tests. |
| `pnpm test:release` | Every Tier 1 and Tier 2 test, plus lint and type check. Once, before a release. |

Tier 1 is every test under `tests/` except `*.perf.test.*`. `test:t1` first runs the static
checks — tokens are fresh, the specifications are consistent (every colour a role, every utility
on Meridian's scales, no dormant export, markdown renders raw HTML inert), the console's own rules
hold (`scripts/check.local.ts`: no raw timestamp, no hardcoded denominator, an empty hand-built
table says so, no source file over 700 lines), contrast holds for every pair in both themes and
every accent — and then Vitest's related selection over the files changed since the last green
run, recorded in `out/last-green` (gitignored). A changed test file runs itself. A docs-only
change runs no test; a changed code path that reaches no test runs the whole Tier 1 set. With no
marker the run compares against `master`; with neither a marker nor a diff it runs the whole tier.

Tier 2 is the file convention `<name>.perf.test.*`. `test:t2` runs the same static checks and the
same selection, and may include those files as well as Tier 1. No `*.perf.test.*` file exists
yet, so in this console `test:t2` runs exactly the affected Tier 1 tests.

`test:release` is the whole standard, once before a release: the static checks, `next typegen`,
`tsc --noEmit`, `eslint .`, every Tier 1 test, `next build`, the route policy and the first-load
and HTML size checks. It writes the marker on success. The browser audits and walks are
diagnostics, not tiers: run `node scripts/audit.ts`, `scripts/interactions.ts`,
`scripts/keyboard.ts`, `scripts/vitals.ts` directly when a change needs
them, and read what each prints.

A page's size is held to its own measured figure in `scripts/verify.baseline.json`, 5% over it at
most, never to a number written by hand; an accepted growth is recorded with
`node scripts/sizes.ts --write-baseline --base <the running build>`.

`ZZ_TEST_REPORT=<file> pnpm test:t1` also writes every test file's result as JSON to that file
(`vitest.config.ts`), so a review quotes a file's result from the run that tested it instead of
running the suite a second time; unset, no run writes it.

**What CI runs.** `.github/workflows/gate.yml` runs `pnpm test:release` on every push to master.
`.github/workflows/weekly.yml` runs the scheduled Tier 2 job, `pnpm test:t2`, on Mondays and on
dispatch. Neither workflow holds a credential or reaches the deployment.

What a run did not exercise, its coverage line says: a check that did not run reads exactly like
one that passed.

What each browser diagnostic checks, and against what, is in
`scripts/verify.config.ts`.

## The assistant

A panel in the shell that reads the page a person is on, answers about it from the
platform's own records, and changes nothing. It is Meridian's assistant, mounted the way
Meridian's guide describes; `docs/brief.md` records what this console decided about it.

It is off until the provider, the key and the model are set, plus `ASSISTANT_BASE_URL` for
`openai-compatible`; every one of them is read from the environment on every request, so one
build serves both. With none set there is no launcher, no panel and no Ask, and
`POST /api/assistant` answers 404. It also reads through `ZZ_GATEWAY`, which every page already
needs. `.env.example` lists them.

| Variable | Meaning |
|---|---|
| `ASSISTANT_PROVIDER` | `anthropic`, or `openai-compatible` for any service that speaks the OpenAI chat-completions format |
| `ASSISTANT_API_KEY` | The provider's key. It never reaches the browser |
| `ASSISTANT_MODEL` | The model's id, exactly as the provider lists it. It must be able to call tools |
| `ASSISTANT_BASE_URL` | The provider's address. Required for `openai-compatible` |
| `ZZ_GATEWAY` | Where this app's server reaches the gateway. Required for every page, not only the assistant: see [How it fits together](#how-it-fits-together) |

What it reads:

- **The page.** Every console page shares a context (`src/logic/*-context.ts`): its scope,
  how fresh the data is, each figure with its definition, what code computed from them,
  and what the data cannot say. Each page's `README.md` says what its context holds.
- **The records.** One prepared collection per measure of the gateway's prepared queries
  (`src/data/prepared.ts`), read as the person asking; the page the person is on offers its
  prepared query, `explore_<view>`, which counts, groups and compares them.
- **Another view.** One `view_<name>` tool per page, each a module under `src/logic/tools/`
  listed in `src/logic/tools.ts`, which opens that view at an address and returns the same
  context the page would share, and declares the page and the prepared query it offers.
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
secret. The thread stays in the browser's local storage; Access has the person's own
switch for the panel. Every reply is stamped with the person and the team it answered, so a
thread from another person or team is cleared before the panel opens and never reaches the
model.

## Deploying

**Released by zz-stack, not by hand.** The console is one of two components in a platform
release — `zz-stack/scripts/release.ts <platform-version> --dashboard=<console-version>` —
which runs this repo's `typecheck`, `lint`, `test` and `gate`, bumps `package.json` and the compose
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

Two workspaces, in the rail's order. **Work** is the team the person acts for; **Platform** is the platform itself. A member's rail holds fifteen: Teams, People and Audit are the superadmin's alone, and a member is answered at their addresses as at an address no page answers.

| | |
|---|---|
| **Work** | |
| **Home** | What waits on you, then last whole week's work beside the week before (words added, closures, approvals in your name), four tiles, the work that is open, the runs active now, the milestones and what closed last week, with a line to Record |
| **Record** | One person's record of writing with agents: words added with the estimated hours behind them and the pace that estimate assumes, the period's closures, approvals, lessons and runs, the year of days and the record table; copy it as text |
| **Initiatives** | The team's open, waiting and closed work: three tiles, Closed split by outcome, closures by week and outcome, and the list with each initiative's next move as zz-core answers it, filtered, searched and paged on the server. Open one for its documents and gates, and close it there: the console sends what the person chose and shows the outcome the platform derived |
| **Approvals** | What waits on your team for a decision and every approval recorded in your name: four tiles, approvals in your name by week, and two tabs, Waiting (Team approvals, each row opening the revision that waits for review) and History (version and content revision, approved at, and presentation and decision basis as the gateway classified them), paged on the server |
| **Knowledge** | The team's search, ranked as the assistant and MCP rank it, then lessons adopted and superseded, the searches that found nothing (most asked first), searches with results by week and the newest lessons, with the store's log behind its tab. A lesson on the shared shelf opens read-only for anybody |
| **Activity** | Your team's real work by week: what was refused and why, by owner, the refusals grouped by owner, tool and message, and the event log |
| **Runs** | The active team's runs: three tiles, each skill by output per run with its calls per run, share refused and typical length, and the recent runs, narrowed by skill |
| **Plugins** | What a person installs: each plugin with whether it is required, its version, skills, gates, its score out of 10 with protocol and date, and a Copy control for its install command; open one for its public score with the comparability statement as the gateway answered it, the owning team's evaluation where the gateway answers it, and its skills with your team's use |
| **Access** | What lets you and your agents in, and nobody else's: your tokens (issue one, shown once; revoke one), the setup to connect a client, the applications and browsers signed in as you (revoke one, sign another out), your passkeys and the team you act for; the members of that team for its admin |
| **Platform** | |
| **Status** | Under Platform, for everybody: what needs attention first, each row that has a page a link to it; the scoreboard of five measures judged against their own history and three activity measures that are never counted better or worse, each with its weeks and its finding; your own team's counts beside them; each door's days; and the version that is running with when its tag was made |
| **Releases** | Under Platform, for everybody: every recorded release, releases and malformed calls per 1,000 by week, and each release's malformed calls, tool failures and p95 in the 72 hours either side of it, partial where the record saw only part of a window; open one for its published changelog, upgrade notes and what clients must do |
| **Bugs** | Under Platform, for everybody: open reports, the oldest open, reports per 1,000 calls and the median hours to resolve; reports filed and resolved by the week filed, the outcomes and the impacts; and the queue, filtered by state, impact and surface. A member reads each report by a title generated from its surface; the superadmin opens a report to read it and resolve it |
| **Evaluation** | Under Platform, for everybody: findings waiting, scores established, how long ago a plugin was last scored, with its date and time, and the days scored; each plugin's latest score out of 10 with its range, standing, guardrails, protocol and date; every score in the series it compares within, with the gateway's comparability statement; and the findings by decision and by owner. A member reads the form everybody may read, the superadmin each waiting finding's own words |
| **Teams** | Under Platform, the superadmin's alone: every team with its people, open work, waiting and lessons, paged and filtered on the server; create one here. Open one for its calls by week and its members, and archive it or add and remove people there |
| **People** | Under Platform, the superadmin's alone: everyone the platform knows, with their role, teams, passkey, last sign-in and state; add a person, give them an enrolment link, or deactivate them |
| **Usage** | Under Platform, for everybody: last week's calls, share refused, slowest 5% of calls and sessions; calls by week (by team for the superadmin alone); the platform's own traffic and all refusals by population; refusals put right; each tool's median; weekday by hour; the tools called most; calls per recorded approval; and the platform's model calls, whose cost is not recorded |
| **Audit** | Under Platform, the superadmin's alone: every recorded act of administration as one sentence, on an Activity feed, with the acts that leave no event named under it; and every recorded event as metadata, the latest 500 within the filters (kind, team, a day they came before), which reach older events. A member is answered as at an address no page answers |
| **Knowledge health** | Under Platform, for everybody: the lessons adopted on every shelf, last week's lessons made outside the import cohorts, searches and share with no result; each shelf (every team's by slug for the superadmin alone, a member's own, the shared shelf and the totals); lessons made by week with what imports left out, exactly or by the day rule; the share of searches with no result by week with the share widened and the mean results; lessons by the week made with the import cohort labelled `imported, by day` and how many were superseded since; lessons by kind; and, for the superadmin alone, the questions with no result |

Statistics come before judgment on every analysis page, because a score with no idea what
it cost to produce is a number nobody can act on.
