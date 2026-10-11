# Bringing Meridian into an existing frontend

When the person already has a frontend and wants it to look and behave like Meridian, choose the route by what is there.
Tell them which route you chose and why, in one sentence, before starting.

## Before you change anything

An existing product has users who rely on what it does today, so learn it before changing it, and keep what it does.

1. **Learn it as a new teammate would**: its README, `AGENTS.md` or `CLAUDE.md`, package scripts, routes, data layer and
   tests. Their conventions govern their code; Meridian's govern Meridian's files.
2. **Find every place it reads or writes**: API base URLs and database URLs in the code and in every `.env` file. An
   address that is not this machine, or a container you started, is production: never run their app against it, not
   even `pnpm dev`. Write the fake API first (Route A, step 5), from the requests their code actually sends, with sample
   records in their own shapes. In place (Route A) it goes in their `scripts/` and is committed on its own, so `adopt`
   finds a clean tree (`adopt` copies Meridian's `scripts/` beside it and leaves a file of another name alone, and an update never changes
   a team file inside a managed folder: `ownership.md`); for a
   new project beside theirs (Routes A2, B) it goes in the new project. Records whose meaning depends on the time
   ("late", "due soon") are placed relative to when the fake API starts, so the same cases exist on every run. Their
   app reads the fake's address from the environment variable they already use: a variable set for the command
   overrides the `.env` file Next loads, and `fakeApi.env` in `scripts/verify.config.ts` does the same for verify. An
   API address is not a `dataUrls` entry; that list is for databases.
3. **Keep a "before"**: run their app against the fake API, from a copy outside the repository (install there, so their
   folder stays clean), and render their main routes at 1440 and 390px with Chrome itself (`"<chrome>" --headless
   --virtual-time-budget=5000 --screenshot=out/standard/before/<name>.png --window-size=1440,900 <url>`, and `390,844`;
   the time budget lets an app that fetches in the browser draw its data before the shot), since Meridian's scripts are
   not there yet. An app that fetches from the browser reaches the fake API from another origin, so the fake answers
   with `Access-Control-Allow-Origin: *`. For a new project beside theirs (Routes A2, B) the order is: `create`, the
   fake API in the new project, then the "before" against it. The hand-over shows each page before and after, and the
   renders record how each page worked. An app that does not run as it stands gets no "before": say so in the
   hand-over, and keep the list in step 4 from its code.
4. **List what must survive** in the scoreboard's floors: every route at its URL, every action and the request it sends
   (the fake API logs them), and their own tests and scripts. When the request itself changes one of these (a filter
   that now needs every order), record the change under "Kept and removed" in the hand-over. A rebuilt page that drops one of these is a regression,
   however good it looks.

When the last page is rebuilt, trace what nothing imports any more (their old UI components, `*.before.css` once
ported, helpers only the old pages used): check dynamic imports and config too, then delete them in a commit of their
own and list them in the hand-over, so the project keeps only what earns its place.

## Route A: Next.js (App Router) with React 18+ (the common case)

Migrate in place, page by page, keeping their data layer.

1. **Run `npx zz-meridian@latest adopt`** in their project, after "Before you change anything", with the brand flags
   from step 2 of SKILL.md (`--name`, `--hex` or `--accent`, `--workspace`, `--timezone`, `--currency`), and commit what
   it changed as one commit before building on it: that is the diff a reviewer reads to see what Meridian brought. It copies Meridian's tokens, styles, components,
   gates and scripts in; merges the dependencies and scripts it needs into their `package.json`; adds `@meridian/*`
   (`src/*`) to `tsconfig.json`; replaces their global stylesheet, keeping theirs beside it as `*.before.css` to port
   from as tokens; writes a first `nav` from their routes into `src/app.config.ts`; brands it; writes a managed block
   into their `AGENTS.md`, between two marker comments, and keeps every byte outside it (a later run replaces only that
   block; a duplicate or unterminated marker is refused, with the files already copied); writes the five-section brief
   `optional:docs/brief.md` when they have none (SKILL.md, step 3: fill it from their answers); installs this skill into
   `optional:.agents/skills/` and `optional:.claude/skills/`; records every copied file in `optional:.meridian/manifest.json`; installs and type
   checks. It refuses, writing nothing, when the git tree has uncommitted
   changes (commit first, so its change is one diff to review), when the project is not Next.js with the App Router,
   or when a file it would copy already exists with other content (it lists them: move theirs, then run it again).
   Meridian's own files import each other by relative path, so their `components/ui/button` is never confused with
   Meridian's.
2. **The template to read from** is the version in `optional:.meridian/manifest.json`, at
   `https://github.com/zhixuan312/zz-meridian/tree/v<version>`: the layouts, the presets in `src/views/` and the pages
   in `optional:app/(dashboard)/`. Without network access to GitHub, `npx zz-meridian@<version> create /tmp/meridian-ref
   --no-install` writes the same files to a scratch folder.
3. Wrap their root layout like the template's `app/layout.tsx` (fonts, the pre-paint script, `Providers`) and their
   console routes in `AppShell` with the rail, `ShellTools` and the command palette (see `optional:app/(dashboard)/layout.tsx`).
   The template's layout passes `ShellTools` the sample `ALERTS` and `DEMO_NOW` from `optional:src/data/sample.ts`, which
   is not copied: pass their own alerts (an empty list until they have some) and their own clock. Give each `nav`
   entry in `src/app.config.ts` its icon and group. The Rail and the palette are rendered from a client module
   (`src/views/console-chrome.tsx`), since each destination carries its icon component, and take what depends on the
   request from the layout as props: `<ConsoleRail access={…} signOut={…} />` and `<ConsolePalette access={…} />`,
   where `access` is a promise of `{ only, user, viewAs }` — the hrefs this person may see, the signed-in person from
   their session, and a View as group if they have one (`ChromeAccess` from `@/lib/collection`, built by your own
   `chromeAccess()`). Both pieces of chrome wait for that promise in their own `<Suspense>` boundary, so the frame is in
   the static shell and the person's own rail streams in the same response; pass the promise without awaiting it, and
   never draw the sample person while it is pending. `workspace` and `scopes` still arrive as plain props. A console
   with no sign-in passes no `access` at all, and the chrome then shows the full `nav` and the `app.user` it was given,
   so the rail never shows a sample person or a Sign out that goes nowhere.
   **Turn on Cache Components.** Meridian's pages prerender a shell and stream what each request reads, and the route
   policy `pnpm verify` runs fails a page that is neither static nor partial. Set `cacheComponents: true` and
   `partialPrefetching: true` in their `next.config` (`cache.md`, "Turn Cache Components on"), and put each per-request read (their API, cookies, headers) behind a `<Suspense>` boundary, as the
   template's pages do. A detail route whose ids come from their API at request time has no `generateStaticParams` to
   list them, and the shell reads the address: wrap the shell in the layout in `<Suspense>` too, or the build stops
   with "usePathname outside Suspense". A route that must stay fully per-request goes in `requestDependentRoutes` in
   `scripts/verify.config.ts`, with its reason.
   **Catch the shell's own data in the layout.** A page's error boundary only catches what the page throws: if the
   layout awaits something the shell needs — the alert list, the signed-in person — one failed query takes the whole
   layout down, and the framework's bare error page shows instead of the designed one inside the shell. Read those
   defensively (`const alerts = await recentAlerts().catch(() => [])`), so the shell stands and the page's own
   `error.tsx` shows "This view did not load" with Retry.
4. Rebuild each page on `PageFrame`, `Stack` and `Row` with Meridian components (imported as
   `@meridian/components/…`), keeping their data fetching and business logic untouched. Their old Tailwind utilities
   render nothing under Meridian's scales, and the gate names each one. Do the busiest page first, and render and score it
   (`standard.md`) before the rest: what it teaches you about their data carries to every other page.
5. **Before `pnpm verify --full`, give it a fake API.** The default `pnpm verify` reads and never presses: the gate,
   one build, the size checks and a navigation smoke of at most three routes, with only the harmless probes your
   `navigationChecks` declare. In an adopted project it reports the browser as `not run` until `verify.config.ts` names
   a `fakeApi`, or says `noLiveApi: true` because the pages read and write nothing outside the repository.
   `pnpm verify --full` presses every control it finds on the built app, Approve, Revoke, Archive and Delete included,
   and refuses without one of the two. If their pages call a live backend, those presses change it. Write
   `example:scripts/fake-api.ts`: a server on `--port 0` that answers every route the pages call with typed fixtures (writes
   answer success and are forgotten), prints `listening on <url>`, and logs each request it answers (method, path and
   body), which is how the scoreboard shows every action still sends what it sent. Name it and the environment variable their app
   reads its API address from in `scripts/verify.config.ts` (`fakeApi: { script, env }`): verify starts it first and
   builds and serves the app against it. Point the build at it, not only the server: an address read in
   `next.config` rewrites is baked in at build time.
   If their pages use web components, every browser suite (the audit, the presses, the keyboard walk, the assistant and
   live-data walk-throughs and the vitals' taps) looks inside open shadow roots, and an element the audit cannot look
   inside is reported as `unmeasured:`; `validation.md` says what to do about it.
   **A direct database connection is the same hazard through another door.** If their pages read `DATABASE_URL` from
   `.env` (or any other data URL: name it in `dataUrls`), a `next build` and `next start` in their folder carry it, so
   Approve and Delete land on whatever it names. verify reports the browser as `not run` in the default, and `--full`
   refuses, when a data URL resolves to a host that is not this machine; point it at a local copy for the run, and set
   `allowRemoteData: true` only when you know what the presses reach. Restore the data afterwards — the walk-through
   flags rows and a press can delete, even on a run where every check passes.
6. List their detail pages worth seeing (a normal record, a failed one, a missing one) in `detailRoutes` in
   `scripts/verify.config.ts`, with ids from the fake API's fixtures. Map their main routes in `navigationChecks` (a
   ready selector and one harmless probe each) so the default smoke covers data and interaction, not only the shell.
   Run `pnpm verify` until it passes, and `pnpm verify --full` before a release; the last line of each says what it
   covered (`coverage: …`).

Without the assistant, `verify --full` skips its walk-through on its own (it runs only when `optional:app/api/assistant/route.ts`
exists).

## Adding the assistant

The panel (`src/components/patterns/assistant/`) already came with `src/components/`, and `AppShell` mounts it when
`optional:app/(dashboard)/layout.tsx` passes `assistant`, a promise it does not await: `assistant={connection().then(() => assistantConfig(process.env) !== null)}`. A product that adopts the assistant also brings
`optional:app/api/assistant/route.ts`, the rest of `src/lib/assistant/`, `optional:src/lib/collection.ts` and `optional:src/data/collections.ts`;
add `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` and `zod` to the dependencies. Point `optional:src/data/collections.ts` at their data, bring `optional:src/data/access.ts` with their own session and permissions in its policy (the route and every server action ask it), and set `ASSISTANT_PROVIDER`, `ASSISTANT_API_KEY` and `ASSISTANT_MODEL`
(plus `ASSISTANT_BASE_URL` for `openai-compatible`): it stays off until they are set. The "Show the assistant" switch is
in `optional:src/views/settings.tsx`.

When their `rows` becomes a real database, two things matter. Pages read through `read()` (`optional:src/data/read.ts`),
which caches per caller's scope and refreshes exactly the tenant a write touched, so do not wrap the read in a second
cache; writes call `updateTag` after the commit (`cache.md`, "Authorized, scoped reads" and "Writes authorize, then
invalidate"). And raise the connection pool's idle timeout past `pg`'s 10-second default, since a cache miss is a round
trip each. Issue #7 has the numbers.

## The database behind the collections

Meridian's sample serves fixtures; a product's collections read a database. What adopters met, and what held (issues #16 and #17):

- **The pool survives a dropped connection.** Keep idle connections for minutes (`idleTimeoutMillis`, `customize.md`), and
  listen for their loss: `pool.on('error', (e) => console.error('db: an idle connection closed', e))`. Without the
  listener, the database or its pooler closing an idle connection is an uncaught error and the server exits. Set
  `connectionTimeoutMillis` so a database that does not answer fails a read rather than hanging it.
- **Behind a transaction pooler** (PgBouncer, Neon's pooled endpoint, Supabase's): pass no session setting to the pool. A
  `statement_timeout` or any startup option is refused at connect ("unsupported startup parameter") and every connection
  fails; set limits with `SET LOCAL` inside each transaction instead. A session advisory lock does not hold across
  transaction pooling: take a start-up lock with `pg_try_advisory_lock`, try it once, and carry on without it. Connect
  migrations, and anything that needs a session, to the direct endpoint.
- **Schema changes run on start, never in the build.** Apply the product's own migrations from `instrumentation.ts`
  (`register`, on the Node.js runtime) under that non-blocking lock, so one instance migrates and the rest serve; keep the
  migrator's bookkeeping in a schema the role may write (`public`); never stop the server on a failure, and report the
  outcome at a health route so a deploy can read it. A build has no database to migrate and must not need one.
- **A role that may read and write but not create.** Deployed roles often lack `CREATE`, and a migrator that starts with
  `CREATE SCHEMA` is refused even where tables may be created. Ship the schema as a one-off SQL file a person with the
  owner's role runs once, and let the application role only migrate within what it may do.

## Route A2: a static HTML page (data fetched as JSON)

The simplest case. Create a new Meridian project (SKILL.md steps 3 and 4) and point a module in
`optional:src/data/` at the same JSON the page fetched today (read the file at build time, or fetch it in a server component).
Rebuild each section of the page as a Meridian page or card; the old page can stay where it is until they switch.

## Route B: another React stack (Vite, Create React App, Remix, Astro islands)

Create a new Meridian project next to theirs (SKILL.md steps 3 and 4), then port into it: their routes become pages,
their data hooks or fetch calls move into `optional:src/data/` (as server functions or client hooks), their domain types come
along unchanged. A read that ran in the browser carried the person's cookies and was allowed by the API's CORS; moved
to the server it carries neither, so forward the session it needs explicitly, or keep it a client read with a
`preload` (`customize.md`). Their old app stays exactly as it is: the new one is finished when it meets the standard (`standard.md`) with every
route and action of the old one accounted for in the scoreboard, and switching over is the person's call. Route A's
steps 5 and 6 hold for the new project: a `fakeApi` that answers what the old app asked for, and `scripts/verify.config.ts`
describing the new project's routes. Its `.env` is not copied: the new project reads the same variable name, set by
whoever deploys it.

## Route C: not React (Vue, Svelte, Angular, server templates)

Meridian's components are React, so the honest options are:

- **A new Meridian project** for the dashboard, talking to their existing backend (usually the best result), or
- **Tokens only**: copy `src/styles/tokens.css` (plain CSS custom properties, framework-agnostic) and rebuild their
  components against those roles by hand, following the card specifications in `src/components/*/*/README.md`. Tell
  them `pnpm verify` cannot validate a non-React app; run the contrast gate on the tokens and audit their pages with
  `node scripts/audit.ts --base <their dev server URL> --routes <their routes>` from a Meridian checkout.

When the request does not say which, take the new project and record it in the brief's Decisions: it keeps their app
untouched and is the one `pnpm verify` can hold to the standard.
