# ZZ Stack console: the brief

The console's product, users, data and decisions, so they outlive the conversation that made them.

## Product

ZZ Stack's console is the browser view of the zz-stack platform: one place to answer whether the platform's work is
moving, and what is waiting on a person. It carries the platform's name rather than one of its own, because it ships
with the platform as one set.

The question it exists to answer is "what needs me now" — which initiative is blocked, which gate document was written
and not approved, which run failed, which plugin has never been evaluated. Every page reports work already recorded
somewhere else; none of them asks a person to enter it again.

## Users

A superadmin reads the whole platform: every team's initiatives, the plugin estate, the fleet's runs and activity, and
the people and tokens behind them.

A member reads their own team. The gateway narrows every read to the caller's own team, so the console's job is to show
the right pages rather than to enforce what may be read.

Both arrive with a question already in mind and want an answer in one glance, not a dashboard to explore. Neither may
ever be shown another team's documents, another person's API key, or a key's value after it was issued — the last of
those is a rule the gateway keeps, and the console must not become a second place it could leak from.

The console is read on a laptop, at a desk, between other work; the phone layout exists so a gate can be approved away
from the desk, not so the product can be browsed on a train.

## A person and their agent, both first-class

Every destination has two customers: the person, and the agent working with them, the console's assistant and any agent
reading the same facts through the platform's door. This is the design premise of every page, not a feature for pages
whose data is too large to read: a destination is designed from the start for both, and is not finished while either
side is missing. Agents do most of the work on this platform, so a console only a person can use serves the smaller half
of it.

So each destination states, together and in the same change:

- what the person sees and does;
- what the agent reads: a tool over the same response the page draws, and the page's shared context, which says what is
  on screen (the period, the date the cursor points at, the filters, the rows in view), the summary of everything behind
  it, and what the data cannot say;
- where the two meet: `AskAbout` in the header actions of the page's protagonist card, asking about exactly what that
  card shows, and what the agent helps the person judge there.

The agent gets the right data at the right time, and is never handed a whole population. Its context stays small and
follows the person's view as it changes: what is on screen, a summary of the population behind it computed on the
server, and what the data cannot say. When it needs more, it queries back. A page is fixed, so the tables and the
queries behind it are fixed and known, and each destination's data is offered to the agent as prepared, parameterised
queries written ahead and checked like any other read: the page's filters, a grouping by a declared dimension or a time
grain, a window, a comparison with the previous window, and a drill down to a group's rows. The agent chooses and fills
them in; it never writes its own SQL, and every query answers within the person's authority and the page's projection.
That is how an agent helps with what no person could read row by row (an audit trail of millions of events) as readily
as with a week's figures. The person decides: an approval, a close or a change is made by the person, and the agent says
where it is made and never claims to have made it.

## Data

A page's own content is a browser fetch to `/api/console/*` by `src/lib/api.ts`, and every write goes through
`src/lib/mutate.ts`. The payload shapes are the gateway's, recorded in `src/lib/api-shapes.ts` (Work) and `src/lib/platform-shapes.ts` (Platform). The console stores
nobody's credential: the browser has a session cookie and sends it to the origin that issued it. The server reads the
gateway as the person asking, through `src/data/gateway.ts`, for two things: `/me` once per request for every page,
which decides whether the page may render and what the rail draws (`src/data/access.ts`), and the assistant's reads.
So `ZZ_GATEWAY` is required for every page. Caddy routes `/api/console` on the console's own host to the gateway, so
the page and its API are one origin.

Freshness means when the data arrived in this browser, not when the page rendered. `freshnessOf` in `src/lib/api.ts`
reads the oldest arrival time among a page's queries, and `useDataClock` reads it for a component that holds no query of
its own; `Freshness`, `ShellTools` and every relative time are stamped against that clock rather than `new Date()`.

A view's state lives in its address — every filter, tab and period is a query parameter — so a link is shareable and an
agent opens the same view by naming the same parameters. `src/lib/address.ts` is the one reader of it, and the one place
a store path is turned into route segments and back — `encodePath`/`decodePath`, which must handle a path one segment at
a time or `sources/2026-10-06-call.md` arrives as a single segment named after itself.

## Decisions

- **Dark first, light available.** Meridian's register. The person switches theme, accent and density in the rail's
  appearance menu or the command palette. The old console's single cream theme is retired.
- **Meridian is the base; ZZ's brand sits on it.** `docs/brand.md` holds the brand principles: three marks from the kit,
  never redrawn; the purple accent for actions only; the mascot only where there is no data.
- **The accent preset is `brand`.** Derived from the ZZ brand purple `#7548d8` by `scripts/brand.ts --hex`: OKLCH hue
  292, chroma 0.18, at least 70° from every status hue so an accent fill never reads as a state. The name is what
  Meridian's hue-and-chroma path calls it, which is what makes the brand reproducible from a release.
- **Two workspaces, one menu.** Work (`/`) and Platform (`/platform`, the platform's Status) are chosen in the rail's
  workspace menu; a workspace is offered when the person may open one of its destinations, and the line under the
  product name names the workspace in view. A superadmin also switches between the whole platform and their own team
  (`Your team · <slug>`), in the same menu under the workspaces and in Settings. In team mode the rail and the
  palette drop the platform-only pages: `src/nav.ts` narrows the destinations the server answered, in the browser,
  so the choice can hide a destination and never add one.
- **The bell lists waiting gates.** Every gate document written and not approved, on an open initiative, or a closed
  initiative's correction awaiting approval, with a link to the initiative.
- **The console's own rules, kept inside Meridian.** Tables read left in the first column, right in the last and centred
  between (`src/console/columns.ts`). A bar's length is its share of the total it is labelled against. A tile or bar used
  as a mark has no legend row; hover names the part. Colour means something: a refusals list is not red on every row.
- **All time is the default period.** A console that opens on the last 30 days shows a total that is not the total, under
  a heading that does not say so. A 24-hour period is the shortest offered.
- **A view is its address, and the address is read from the window.** Reading Next's search params costs a prerendered
  route its prerender — `useSearchParams` client-renders every Client Component up to the nearest Suspense boundary, and
  a console page has none — which measured 2212ms of LCP on `/teams` against 632ms once the address was read directly.
- **The console-scope section is drawn for everyone; only its switch is earned.** `/settings` opens with it, so its
  presence may not depend on what `/me` says; the sentence says which of the two people has the choice, and the row holds
  the height it would have either way.
- **Cache Components is on, and every route is partial.** `cacheComponents` and `partialPrefetching` are set in
  `next.config.ts`, and `scripts/route-policy.ts` reads 2 static and 22 partial of 24 non-API routes. Every page asks
  `gate` on the server first, inside the boundary its own `loading.tsx` gives it, so a page's static shell is the frame
  and its loading page, and the page streams in once the gate has passed. `app/(dash)/layout.tsx` is a Server Component
  rendering the shell, and the rail, the tools and the palette each resolve what they need behind their own
  `<Suspense>` with a skeleton fallback. A route that fails with `CLIENT_HOOK_DYNAMIC` is asking for a boundary.
- **Live data: the release's `ConsoleLive`, with React Query where the release refreshes the router.** One stream per
  tab carries hints naming a collection and never data, and the tab reads that collection again. The release's
  `src/views/console-live.tsx` is adopted whole with its one product-specific part replaced: there `refresh` calls a
  Server Action that drops the tenant's cached reads and refreshes the router, and here there is nothing on the server
  to drop, because `src/lib/api.ts` reads from the browser and says why — so the cache is React Query's and dropping it
  is `invalidateQueries` over the console queries whose collection the hint names. A read's collection is its own first
  path segment (`/teams` reads `teams`), so no new vocabulary crosses the wire, and each page says what it shows in one
  `useLive([...])` line. The stream opens only once `/me` answers, so a signed-out tab opens none.
- **The shell's `<Suspense>` carries a fallback that draws the frame, not `null`.** That boundary is load-bearing —
  `AppShell` calls `usePathname`, and Cache Components will not prerender a client hook in a route it can prerender
  whole, so removing it fails every route with `CLIENT_HOOK_DYNAMIC`. Next resolves the hook on the server only where
  every segment is known at build time; on a route with an unknown dynamic param it suspends, so the boundary is
  postponed and the prerendered HTML holds the fallback. With `fallback={null}` that was no nodes at all, and a page
  load put the client's own render of the shell where the server had emitted nothing: React's hydration mismatch
  (#418), on a different route each run and only under load.
- **The phone card's approval slot shows the verdict alone.** A card puts it at the end of the title line, where the
  slot is one badge wide and the cell that holds it is `shrink-0` — Meridian's own rule — so it cannot shrink to fit.
  The longest row carried a correction badge *and* an outcome badge, each nowrap: 348px in the 336px a 390px card has
  left after its padding, which pushed the row 12px past its frame. `DocStatus` grows `compact` and the column's
  `mobileCell` renders it; the two extras are still read on the same page, in the table and in the flow stepper above.
- **The assistant is Meridian's, mounted the way Meridian's guide says, and it changes nothing.** The panel, the
  route (`app/api/assistant/route.ts`) and `src/lib/assistant/` are the release's own; `src/data/` and `src/views/` are
  this console's: the access policy, one read-only collection per list, and one shared context per page (decision
  0011), built by a pure function the page and its `view_<name>` tool both call. It is off until the provider, the key
  and the model are set, plus `ASSISTANT_BASE_URL` for `openai-compatible`, read per request. Every change in this
  console stays on its page, by the person: no collection gives an agent a tool that writes, and what a page does is
  declared `pageOnly` so the assistant says where it is done. Approval above all: a document is approved by a member
  who was shown that exact snapshot, never by an agent.
- **This app's server reads the gateway as the person, in one module.** Every page's gate and the chrome read `/me`
  once per request, and the assistant's route has to know who is asking before a model is reached while its tools look
  records up as a reply is written. `src/data/gateway.ts` sends the caller's own `zz_console` cookie, that cookie
  alone, to the gateway that issued it, and asks for the platform scope on every read but `/me` and `/search`, which
  the gateway grants only to a superadmin. A page's own content is still read from the browser. This is the "server
  replays the caller's cookie" shape the console avoided while it was only a renderer; it was taken on for the
  assistant on 2026-10-12 and for every page's gate on 2026-10-14, bounded to that module, and it stores nothing.
- **The assistant reads what documents say through the platform's own search.** `view_search` asks `GET /search`,
  which is zz-core's `knowledge_search` run as the person: the text of every document and knowledge node of the team
  they act for, and of the platform's shared shelf, ranked, each result a matched excerpt with the address of the page
  that shows it. It is the one tool that reads content; every list the assistant can query holds titles, states and
  counts, and the Knowledge page's own field filters titles and opening excerpts. It has no page of its own, its
  context is held to a view's 2,400 characters by sharing the room between results, and it takes no platform scope:
  the gateway refuses one team's search asked for as the fleet's. Set on 2026-10-12, when the Ask tab went: the
  answer the gateway used to write is the assistant's to write, over the same retrieval.
- **The chrome is the release's, drawn from the server's answer.** The rail and the command palette are Meridian's
  `ConsoleRail` and `ConsolePalette` (`src/views/console-chrome.tsx`), unchanged, given the workspace the address is in
  by `src/views/workspace-chrome.tsx`, the release's adapter. The layout hands both one promise, `chromeAccess()`, made
  on the server and not awaited: the destinations the person may open and who they are, from the same request's read of
  `/me`. An identity nobody can resolve settles on `null`, and the chrome names nobody. The browser adds one thing: the
  superadmin's team view narrows that answer, and can only take away.
- **The rail is grouped by who reads a page, so a group's name is true for everybody.** The work, its knowledge and its
  people first; then "Platform", the plugins, runs and audit feed only a superadmin reads; then Settings. Meridian's
  chrome narrows a group's items and keeps its label, so a group that mixed a member's pages with the fleet's would
  read "Platform" over one team's shelf. Set on 2026-10-12, replacing a group that renamed itself per view.
- **The rule for anything Meridian has an answer to**, set on 2026-10-12: use the release; where it lacks something or
  gets it wrong, read the issue list and file it; write the console's own only as the interim, and say so where it is
  written.
- **A collection's conditions, sort and page are the release's.** `src/data/gateway-collection.ts` reads the gateway
  and hands the rows to the release's `queryRows`, so there is no second copy of the query rules here. zz-meridian#24
  asked for a row query exported on its own, and 0.15.0 ships it.
- **The assistant reads and does not write, by the release's own switch.** A collection gives an agent a tool only for
  an operation it allows, and this console's allow none: what a page does is declared `pageOnly`. Letting it propose a
  change (revoke a token, add a member, archive a team) is a feature to decide, not a gap in the adoption, and it needs
  the gateway to record that a change was made through the assistant.
- **Knowledge has no Ask tab.** The page that answered a question from one team's shelf, through the gateway's own
  model call, is gone: the assistant is the one place a question is asked. It finds nodes with `query_knowledge` and
  reads one with `view_knowledge_node`, whose context carries the lesson itself. What that drops is the gateway's
  ranked retrieval over document bodies; the assistant searches titles, excerpts and tags.
- **A document is read at the canvas width, with its running text capped at 92ch — not at `--reading-width`.** The
  person's own complaint, in their words: the documents are already long, and squeezing one into a centred strip makes
  it longer. `reading-width` is 832px, and this page is not one document — it is a document beside the colophon and
  version chain that say what it is and how it changed, with tables and code inside it that want the room. At 2560 the
  panel is about 1444px and the prose column about 828px inside it, which looks like a gap in arithmetic and reads as
  the Decisions table's width on the page (measured 2026-10-12, `questions.md` 8). **0.14.0's own note agrees from the
  other side**: `reading-width` "said it was for forms, documents and settings, which nothing did", and now says what
  it is — one long document.

## Glossary

- **Gate.** A document that must be approved before anything downstream of it may be written.
- **Initiative.** The unit of work: an open piece of work with its own documents, sources and outcome.
- **Platform mode / team mode.** The scope a superadmin is reading in. A member is always in team mode.
- **Waiting.** A gate document written and not approved: on an initiative that is still open, or on a closed one whose
  closing document was corrected after the close. The bell's own word.
- **Routable door.** An MCP endpoint a client can be pointed at. The console does not draw them yet.
- **Fleet surface.** A page that reads across every team — Plugins, Runs, Teams and Activity. Dropped in team mode.

## How it is checked

`pnpm verify` runs the gate (tokens, specifications, the console's own rules, contrast, lint, types, tests), builds the
app against a fake gateway (`scripts/fake-gateway`), serves it, and runs the route policy, size and navigation checks it
is configured for. The fake gateway exists because the presses approve, revoke and archive whatever a page offers, so
they must never reach the real deployment. Its records are synthetic; nobody in them is a real person.

`pnpm verify --full` adds every mapped rail route and the exhaustive suites; `pnpm verify --perf` takes 20 samples per
route, device and condition. What a run did not exercise, its coverage line says.

## Staying in step with Meridian

This console is an adopter of the `zz-meridian` package, not a copy of its repository. `.meridian/manifest.json` records
the release its files came from and a hash of each, so a sync is one command on any machine rather than a copy out of a
checkout:

```
npx zz-meridian@latest update --dry-run   # what it would change, and what needs a decision
npx zz-meridian@latest update             # apply, stage the conflicts, install
npx zz-meridian@0.14.0 update --finalize  # pinned to the release that started the session
```

`--dry-run` first is not a courtesy. It replays *both* releases carrying this product's own brand, and without that
replay every managed file holding our accent or our product name looks like a collision: a hand diff against the
release's pristine template reports 39 conflicts here where the true number is 15.

What stays the console's own, and why:

- `src/app.config.ts`, `src/nav.ts`, `src/console/`, `app/`, `src/lib/{api,mutate,api-shapes,platform-shapes,address,format,color,knowledge-filters}.ts`
  and the rest of the data layer: the console's product, its routes and the shape the gateway answers in.
- `src/lib/period.ts`: the 24-hour period, all time by default, and `PERIOD_SHORT`'s `24H`.
- `src/views/console-live.tsx`: the release's team-owned live glue, adopted whole with its one product-specific part
  replaced — `refresh` drops React Query's cache for the collection a hint names, where the release calls a Server Action
  and refreshes the router, because this product reads from the browser and has nothing on the server to drop.
- `scripts/check.local.ts` and `scripts/verify.config.ts`: the project's half of Meridian's hooks.
- **Both stand-ins are gone, and this is the record of why.** 0.14.1 carries them: `data-table` puts a phone card's title
  at the left edge whatever the column order, so `/activity`'s `kind` column no longer needs its own `align: 'left'`, and
  the craft recipe prescribes a built app, so the note about rendering against `next start` rather than `next dev` is the
  release's own now. Both were reported with measurements on 2026-10-11 and are in 0.14.1.
- `src/console/words.ts`: the three rules the words about a count need — `plural(n, 'skill')`,
  `sentence(text)` and `count(n)`. One module rather than three dozen call sites, because the plural was wrong in
  seventeen places while the idiom sat in others, the dash was written once and re-derived once, and a rule written
  twice is a rule that drifts. `scripts/check.local.ts` refuses the two shapes of a hand-rolled plural that cannot be
  anything else.
- Settings sections are Meridian's `FormSection` with `as="div"`: the same head column and card with no form around
  them, `flush` where the card holds a table. The console's own `SettingsSection` stood in for it until the release
  had that variant (zz-meridian#5) and is gone; a one-time token or enrolment link is shown at the top of the card it
  belongs to.
- `proxy.ts`: the address every page request asked for, which the gate sends a signed-out person back to after sign-in,
  and the laptop's dev-only PAT passthrough, plus one addition this product made — a preload hint for a document
  route's read. A route with an unknown dynamic param cannot render its page on the server, so nothing writes
  the hint `useConsole` was designed to write from the HTML, and the read then waits for the route's own JS. Measured:
  2,180 ms to 164 ms.
- `scripts/fake-gateway/`, `scripts/approve-banners.ts` and `scripts/live-check.ts`: the fixture and the product's own
  checks that `verify` runs. The live check drives a change through the fake gateway's own hooks, which wear the path
  the app proxies (`/api/console/__hint`) so a check never has to know the gateway's address.

What `verify` cannot say is how the pages look against production data. The fixtures cover the states a page draws,
and real data has more.
