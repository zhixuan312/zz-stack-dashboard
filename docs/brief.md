# ZZ Stack on Meridian: the brief

The decisions behind the console's move to ZZ Meridian, so they outlive the conversation that made them.

## What it is and for whom

ZZ Stack is the browser console for the zz-stack platform. It carries the platform's name rather than one of its own, because it ships with the platform as one set. A superadmin reads the whole platform; a member reads
their own team. The home page answers one question: is the platform's work moving, and what is waiting on a
person?

## Route

Meridian came into the existing project (Meridian's route A): its tokens, components, shell and scripts were
copied in, and every page was rebuilt on them. The data layer did not move. Every read is still a browser
fetch to `/api/console/*` (`src/lib/api.ts`), every write goes through `src/lib/mutate.ts`, and the payload
shapes are still the gateway's (`src/lib/api-shapes.ts`). The routes are the same routes.

## Decisions

- **Dark first, light available.** Meridian's register. The person switches theme, accent and density in the
  rail's appearance menu or the command palette. The old console's single cream theme is retired.
- **Accent `zz`.** Derived from the ZZ brand purple `#7548d8` by `scripts/brand.ts --hex`: OKLCH hue 292,
  chroma 0.18. It is 70° or more from every status hue, so an accent fill never reads as a state. The contrast
  gate passes in both themes without lowering the fill.
- **The brand on top.** Meridian is the structure; ZZ's marks, mascot and voice sit on it. `docs/brand.md`
  holds those principles.
- **Scope in the workspace menu.** A superadmin switches between the whole platform and their own team from
  the rail's workspace menu (and in Settings). The rail drops the platform-only pages in team mode
  (`src/nav.ts`).
- **The bell lists waiting gates.** Every gate document that is written and not approved, on an open
  initiative, or a closed initiative's correction awaiting approval, with a link to the
  initiative.
- **No assistant.** Meridian's built-in assistant is not adopted: it needs collections the console does not
  have and a model key nobody asked for. The shell no longer mounts it, and `verify` has no assistant step.
- **The console's own rules, kept inside Meridian.** Tables read left in the first column, right in the last
  and centred between (`src/console/columns.ts`). A bar's length is its share of the total it is labelled
  against (`BarList total`). A tile or bar used as a mark has no legend row; hover names the part. Colour
  means something: a refusals list is not red on every row.
- **The console-scope section is drawn for everyone; only its switch is earned.** `/settings` opens with it, so
  its PRESENCE may not depend on what `/me` says. Returning `null` until the read landed kept the page's largest
  text block out of the HTML, and `/settings` was the console's slowest page because of it (LCP 2624ms against 0.6s
  on every page that ships its own words). The sentence is the same for a member and for a superadmin and says
  which of them has the choice, so a member reads why they have no switch rather than nothing. The row holds the
  height it would have either way — a member's slot keeps the space the switch takes and nothing in it, `aria-hidden`
  because a gap is not a control — and the sentence names no team, because a largest block that changes when the
  read lands re-paints, and the paint after hydration is the one the LCP takes.
- **A view is its address, and the address is read from the window.** Every filter, tab and period is a query
  parameter, and `src/lib/address.ts` is the one reader of it. Reading Next's search params instead costs a
  prerendered route its prerender — `useSearchParams` client-renders every Client Component up to the nearest
  Suspense boundary, and a console page has none — which measured 2212ms of LCP on `/teams` against 632ms once
  the address was read directly. `scripts/check.ts` refuses the pattern in any page that has no boundary of its own.

## How it is checked

`pnpm verify` runs the gate (tokens, specifications, the console's own rules, contrast, lint, types, tests),
builds the app against a fake gateway (`scripts/fake-gateway/`), serves it, audits every page at five widths in
both themes, presses every control, follows every link, walks the whole keyboard path, draws the Approve banners a
page load cannot reach (`scripts/approve-banners.ts`), and measures Web Vitals on a mid-range phone. The fake gateway exists because the presses approve, revoke and archive whatever a page offers,
so they must never reach the real deployment. Its records are synthetic; nobody in them is a real person.

`verify` runs the fixture in `normal` mode. Its other four worlds — `empty`, `slow` (every answer four seconds
late), `error` and `extreme` (names longer than any layout planned for) — are reached with
`GET /__mode?set=<mode>` on the running fake gateway and are swept by hand: twelve routes through all five, which
is how the layout shift a stalled read can cause was ruled out of `/settings`. A page's states are design work
that a green `verify` does not see.

## Staying in step with Meridian

The console's copy of Meridian is kept as close to upstream as it can be, so a re-sync is a copy rather than a
merge. What stays the console's own, and why:

- `base/shell`, `base/app-mark` and `base/providers`: no assistant, and the ZZ wordmark.
- `src/lib/address.ts`: the reader the console's view state goes through, because Next's `useSearchParams` costs a
  page the prerender that carries its own text.
- `src/lib/period.ts` (a 24-hour period, all time by default), and the write in PeriodSelect that rebuilds the
  address from the address rather than from Next's copy of it.
- `src/lib/format.ts`, `color.ts` and `preferences.ts`: exports the console uses or does not, and the `zz` accent.
- The `zz` accent in `tokens/` (`accent.zz.tokens.json`, the resolver's default).
- The project's half of Meridian's hooks: `scripts/check.local.ts` (run by the gate) and `scripts/verify.config.ts`
  (the detail routes and the fake gateway).

What `verify` cannot say is how the pages look against production data. The fixtures cover the states a page
draws (empty, waiting, closed three ways, long names, a vendored plugin never run), and real data has more.
