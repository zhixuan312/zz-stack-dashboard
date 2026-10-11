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

## Data

Every read is a browser fetch to `/api/console/*` by `src/lib/api.ts`, and every write goes through `src/lib/mutate.ts`.
The payload shapes are the gateway's, recorded in `src/lib/api-shapes.ts`. The console holds nobody's credential: the
browser has a session cookie, sends it to the origin that issued it, and this app is a renderer. Caddy routes
`/api/console` on the console's own host to the gateway, so the page and its API are one origin.

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
- **Scope in the workspace menu.** A superadmin switches between the whole platform and their own team from the rail's
  workspace menu and in Settings. The rail drops the platform-only pages in team mode, from `nav` in `src/app.config.ts`
  narrowed by `src/nav.ts`.
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
  `next.config.ts`, and `scripts/route-policy.ts` reads 2 static and 22 partial of 24 non-API routes. It is the
  boundaries that make it work, not a server data layer: `app/(dash)/layout.tsx` is a Server Component rendering the
  shell, and the rail, the tools and the palette each resolve their own reads behind their own `<Suspense>` with a
  skeleton fallback. A route that fails with `CLIENT_HOOK_DYNAMIC` is asking for a boundary, and a page gets smaller
  for it — `/initiatives` serves 38 KiB of HTML where it served 65.
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
- **The assistant is Meridian's, and this console does not mount it.** Its components and its route-side code ship with
  the release and stay on disk as part of Meridian's library; nothing renders the launcher, and the shell passes no
  assistant. Adopting them is a decision for whoever brings the collections and the model key.
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
- **Waiting.** Written and not approved, on an initiative that is still open. The bell's own word.
- **Routable door.** An MCP endpoint a client can be pointed at; the console shows which are live and which are refused.
- **Fleet surface.** A page that reads across every team — Plugins, Runs, Teams and Activity. Dropped in team mode.

## How it is checked

`pnpm verify` runs the gate (tokens, specifications, the console's own rules, contrast, lint, types, tests), builds the
app against a fake gateway (`scripts/fake-gateway`), serves it, and audits the routes it is configured for. The fake
gateway exists because the presses approve, revoke and archive whatever a page offers, so they must never reach the real
deployment. Its records are synthetic; nobody in them is a real person.

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

- `src/app.config.ts`, `src/nav.ts`, `src/console/`, `app/`, `src/lib/{api,mutate,api-shapes,address,format,color,knowledge-filters}.ts`
  and the rest of the data layer: the console's product, its routes and the shape the gateway answers in.
- `src/lib/period.ts`: the 24-hour period, all time by default, and `PERIOD_SHORT`'s `24H`.
- `src/views/console-live.tsx`: the release's team-owned live glue, adopted whole with its one product-specific part
  replaced — `refresh` drops React Query's cache for the collection a hint names, where the release calls a Server Action
  and refreshes the router, because this product reads from the browser and has nothing on the server to drop.
- `scripts/check.local.ts` and `scripts/verify.config.ts`: the project's half of Meridian's hooks.
- **Two local fixes stand in for gaps Meridian has now fixed upstream, and should be removed when the release carries them.**
  `/activity`'s `kind` column declares `align: 'left'` because a phone card's title used to keep its table alignment;
  Meridian's `data-table` resets it now. And the craft screenshots are taken against `next start` rather than
  `next dev`, which is what `standard.md` prescribes now. Both were reported with measurements, both were fixed in the
  template's own repository on 2026-10-11, and neither is in 0.14.0.
- `src/console/words.ts`: the three rules the words about a count need — `plural(n, 'skill')`,
  `sentence(text)` and `count(n)`. One module rather than three dozen call sites, because the plural was wrong in
  seventeen places while the idiom sat in others, the dash was written once and re-derived once, and a rule written
  twice is a rule that drifts. `scripts/check.local.ts` refuses the two shapes of a hand-rolled plural that cannot be
  anything else.
- `src/console/settings/section.tsx`: the same grid as Meridian's `FormSection` — a 15rem head column beside a card
  capped at `--field-width` — but not `FormSection` itself, which wraps its card in one form with one save bar. A
  Settings section here holds tables and forms of its own, each with its own save. Since 0.14.0 the Settings *page*
  passes `width="form"`, which is the measure those two columns add up to.
- `proxy.ts`: the laptop's dev-only PAT passthrough, plus one addition this product made — a preload hint for a
  document route's read. A route with an unknown dynamic param cannot render its page on the server, so nothing writes
  the hint `useConsole` was designed to write from the HTML, and the read then waits for the route's own JS. Measured:
  2,180 ms to 164 ms.
- `scripts/fake-gateway/`, `scripts/approve-banners.ts` and `scripts/live-check.ts`: the fixture and the product's own
  checks that `verify` runs. The live check drives a change through the fake gateway's own hooks, which wear the path
  the app proxies (`/api/console/__hint`) so a check never has to know the gateway's address.

What `verify` cannot say is how the pages look against production data. The fixtures cover the states a page draws,
and real data has more.
