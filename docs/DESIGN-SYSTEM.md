# Design system

The whole system in one page: the tokens, the layout contract, the component
catalogue, and the mistakes that render without an error and simply look wrong.

---

## 1. Tokens

Everything visual resolves to a CSS custom property in `app/globals.css`. There
are three layers, and you should only ever edit the first two.

### The cream ramp

One warm ramp. Every neutral in the product is a rung on it — which is what
stops "a slightly different grey" from being invented at a call site.

| rung | value | where it lands |
|---|---|---|
| `--c-0` | `#ffffff` | the only pure white; inputs and popovers |
| `--c-25` | `#fffbf9` | `--surface` — cards sit *lighter* than the page |
| `--c-50` | `#f8efea` | `--bg` — the page ground |
| `--c-100` | `#f4e9e3` | `--bg-sunk`, `--surface-2` |
| `--c-200` | `#e9ddd6` | `--line` |
| `--c-300` | `#d8c8be` | `--line-strong` |
| `--c-500` | `#6e6574` | `--ink-faint` |
| `--c-700` | `#5a5160` | `--ink-soft` |
| `--c-900` | `#221b26` | `--ink` |

Every rung has a semantic token pointing at it; a rung nothing maps to is a
licence to invent a grey.

**The ink rungs are derived, not picked.** `--c-500` is the ramp's hue derived
until it clears the 4.5:1 floor — 5.41 on surface, 4.91 on bg, 4.78 on the tint.
Pick by eye, verify by formula, ship the verified value.

### Brand and status

**One accent.** `--zz-purple` `#7548d8` / `--zz-purple-deep` / `--zz-purple-tint`,
reached through `--accent` / `--accent-deep` / `--accent-tint`. It marks the
primary action, the active nav item, the focus ring, and the single number on a
page that carries the finding. That is the whole list.

**Three kit pastels** — `--zz-lavender` `--zz-pink` `--zz-blue`. These are the
brand's own secondary hues and they exist for one job: the categorical chart
cycle, where the series carry no ranking and the colour is a label. They are not
semantic, they never mean good or bad, and they are never a text colour — see
"Chart pastels are exempt from the contrast gate" below.

**Three reserved status hues** — `--green` / `--amber` / `--red`. They mean
good / warn / bad, and nothing else may use them. They carry all the semantic
weight in the product because nothing else competes with them.

Each hue has a **fill** tone and a **text** tone (`--green` vs `--green-text`).
Paint with the fill, write with the text tone. A fill that reads perfectly as a
4px dot fails at 4.5:1 as 11px type.

### Filled surfaces need a foreground token

`--on-accent`, `--on-danger`, `--danger-fill`.

A filled button's label colour is **not a constant** — it belongs to the fill.
`--on-accent` is white because white on `--accent` clears the floor;
`--on-danger` is white for the same reason on `--danger-fill`. Hard-code
`text-white` and the button is correct by luck: repoint `--accent` to a lighter
hue during a rebrand and every one of those labels silently drops below 4.5:1
with nothing failing.

### Semantic tokens — what components actually reference

| Token | Means |
|---|---|
| `--bg` / `--bg-sunk` | page ground / recessed ground |
| `--surface` / `--surface-2` | card surface / secondary surface |
| `--ink` / `--ink-soft` / `--ink-faint` | primary / secondary / tertiary text |
| `--line` / `--line-strong` | hairline / emphasised border |
| `--accent` / `--accent-deep` / `--accent-tint` | brand, its dark variant, its wash |

**Rebrand by repointing these**, not by editing components.

### The ground is cream, on purpose

DELIBERATE: the ZZ brand kit has cream as its own primary, and the console carries
the brand. A coloured ground is safe here because it is measured: ink and the
accent both clear their floors on it, and `scripts/verify-contrast.ts` holds every
enumerated pair and exits non-zero. Colour is still for meaning — green, amber and
red mean good, warn and bad, and one accent marks one thing per view. The kit's
pastels are used only where colour is a *label*, in the categorical chart cycle.

**Do not "fix" the ground to grey.**

### Geometry

`--r-sm: 8px` (badges) · `--r: 10px` (controls) · `--r-md: 12px` ·
`--r-lg: 16px` (panels) · `--r-pill: 999px`.

The kit's own geometry is soft, and the radii carry that further than any single
component does.

`--r-pill` is **not** a fifth step on the ladder. It is a distinct statement:
full-round says "this is a token, a count, a state" — a badge, a chip, a mascot's
frame. Reach for it where roundness carries meaning, not where you want a rounder
rectangle. The distinct-radii budget is 5 and that is the whole ladder, so a sixth
value invented at a call site fails the audit.

### Elevation — hairlines, not shadows

In-page surfaces get **no shadow**. They are separated by hairlines and by
space. Only things that genuinely float — menus, popovers, dialogs, toasts — get
`--shadow-pop`.

### The surface weight ladder

`<Card weight>` has four steps:

| weight | treatment | use |
|---|---|---|
| `flat` | no boundary | grouping by space alone — reach for it first |
| `default` | hairline | a real object with a real edge |
| `soft` | tinted fill, no border | quiet context beside the main content |
| `hard` | 2px ink edge | the single most important object. One per screen. |

Whitespace groups before borders do.

### One theme — there is no dark mode

`globals.css` defines the palette exactly once, in a bare `:root`. Any `dark:`
variant, any `[data-theme='dark']` selector and any `prefers-color-scheme` query
renders nothing and fails `checks/no-dark-mode.ts`.

DELIBERATE: the kit is a cream identity with a mascot, and a dark inversion of it
is a different product wearing the same logo. One theme, measured once.

### Tailwind mapping — `@theme inline`

A colour is only usable as a utility if it is listed in the `@theme inline`
block. `--color-sage-deep: var(--sage-deep)` is what makes `text-sage-deep`
emit CSS.

> **This fails silently.** A class whose colour is not mapped emits *no CSS at
> all* — the element keeps its inherited colour and the page looks merely
> "slightly off". Adding a raw variable is half the job; map it too.

### Theming a scope

The mechanism that makes a rebrand a token edit rather than a component sweep:
remap the semantic layer under an attribute. Because the mapping is
`@theme inline`, utilities resolve the live variable and every component swaps
with no JS branch and no re-render:

```css
[data-env='staging'] {
  --accent: var(--steel);
  --accent-deep: var(--steel-deep);
  --bg: var(--c-100);
}
```

Set `data-env` on any ancestor.

**Two rules if you do it.** Remap only the semantic layer — never a `--c-*`
rung, which is the ramp itself and would move every token pointing at it. And
whatever you remap must clear the same contrast floors: add the pairs to
`scripts/verify-contrast.ts`, because a scope nothing enumerates is a scope
nothing checks.

### Type — three families, seven sizes

**Rubik** for everything, **Baloo 2** for the two largest steps, **JetBrains
Mono** for identifiers and code. There is no serif. A serif headline reads as
editorial voice, and an interface has a hierarchy rather than a voice.

Rubik is a workhorse UI face with slightly rounded terminals that sits with the
kit's geometry, and it holds at 11px.

**Baloo 2 is used at exactly two sizes and nowhere else** — `.t-stat` (40px) and
`.t-display` (32px), bound through `--font-display-family`. It is a rounded
display face: at 40px it makes a number feel drawn, at 14px it would make the
product look like a children's app. Do not reach for it for a panel title.

`.t-stat` also sets `tabular-nums`, so a column of figures lines up and a metric
does not jitter as it updates.

| px | name | role | class |
|---|---|---|---|
| 40 | stat | the dominant number | `.t-stat` |
| 32 | display | the largest heading | `.t-display` |
| 22 | title | page and section headings | `.t-title` |
| 16 | lead | panel titles | `CardTitle` `.t-heading` |
| 14 | body | prose, table cells, controls | `.t-body` `.t-label` |
| 12 | small | captions, meta, dense cells | `.t-sm` `.t-mono` |
| 11 | label | uppercase eyebrows, axis ticks, legends | `.t-eyebrow` `.t-micro` |

**Seven rungs, more classes.** The classes outnumber the sizes because a name
says what a thing is, and two things at the same size can be different things:
`.t-eyebrow` and `.t-micro` are both 11px, `.t-body` and `.t-label` both 14.
Renaming one does not resize it. What is not allowed is an eighth rung.

Three weights — 400 body, 500 labels and controls, 600 headings and stats.
Four is the ceiling.

**Tracking is not decoration.** Large type gets `-0.022em`; without it big
numerals set loose and read as a price tag.

**Mono is for identifiers and code only** — never metric labels, table headers or
status stamps.

**Never shrink type to fit. Cut words instead.**

### One dominant object

A page should have exactly one thing the eye lands on first, and the ratio
between it and the body text measures whether it does. `pnpm audit:design`
reports it. Analytical pages should be **3× or better**. A page whose largest
text is 20px against a 15px median has no hierarchy.

Pages whose dominant object is a table or a form (Settings) legitimately score
lower: the object carrying the page is not type.

### Colour discipline

- **One emphasis per view, and identity is a different register.** `MetricCard
  emphasis` marks the single tile carrying the finding; `BarList highlight` marks
  the single bar worth pointing at. Everything else is the neutral population.

  Each metric tile also carries its own quiet `tint`, on the 32px icon chip and
  nowhere else. That is identity, not emphasis, and the two do not compete: the
  chip is a soft `--*-tint` ground under a `--*-deep` glyph. A tile keeps its
  one-line definition visible — a definition in a tooltip most readers never open
  is not documentation.

  Only tints with a measured chip pair may be used: `CHIP` in `src/lib/tints.ts`
  is a map, not a template string, so a tint without one is a type error rather
  than a chip that silently renders grey.
- **The status trio is reserved.** `sage` / `amber` / `rose` mean good / warn /
  bad, and they are not in the categorical chart cycle — that cycle is
  `accent` → `lavender` → `pink` → `blue`, four kit hues that carry no meaning.
  Using a status hue *with* meaning is correct and expected: the Overview's
  Event-kinds list passes `tint: k.failed ? 'rose' : undefined`, and a red bar
  there says "these failed". Refusal rate is `rose` because refusals are bad, and
  Context pulled per run is `amber` because its own question is "is the system
  straining?". A tile that is merely neutral takes a kit hue.

  **A tile has no threshold state.** The chip is identity and the delta pill is
  direction; crossing a threshold has no visual, and the number carries the tile.
  `emphasis` is for singling one tile out, one per row.
- Soft fill + strong border is the house pattern for a tinted object.

### Chart pastels are exempt from the contrast gate — on purpose

`--zz-lavender`, `--zz-pink` and `--zz-blue` sit around 1.9–2.4:1 against the
surface. DELIBERATE: they are excluded from `scripts/verify-contrast.ts`:

- They are **never text and never a control.** They fill chart geometry only.
- WCAG 1.4.11's 3:1 floor targets controls and graphics whose *shape* carries
  meaning. A series' identity here comes from its legend, its label and its
  position — the fill is reinforcement.
- Darkening them to clear 3:1 gives four hues that all read as "dark purple" at
  a 4px bar width, which destroys the one thing a categorical palette is for.

What holds them accountable instead is `--chart-edge`
(`inset 0 0 0 1px rgba(34, 27, 38, 0.13)`): every pastel fill carries a hairline
so its boundary is always legible even where the fill is not. A pastel without
that edge is the bug. `checks/chart-series.ts` enforces the cycle and the edge.

**A fifth series colour goes in the cycle and gets the edge — and does not go in
the contrast script, which would then be lying about what it checks.**

---

## 2. Brand — three marks, one mascot, and where the pixels live

### Three marks, and they are not scaled copies of one another

| Mark | File | Size | Why it is its own drawing |
|---|---|---|---|
| Wordmark `Zz` | `public/assets/brand/wordmark.png` | 22–30px, in-app | Sits beside the product name in the rail and reads as identity |
| Flat single `Z` | `app/icon.png` | 32px, browser tab | Two letters at 16px is mush. One letter survives |
| Mascot squircle | `app/apple-icon.png` | 180px, home screen | At 180px there is room for the character, and the character is the point |

**`AppMark` is the only place a mark is drawn in the application.**
`checks/one-mark.ts` enforces it.

The image is decorative (`alt=""`); the accessible name comes from the `APP_NAME`
text beside it, or from an `sr-only` span when the wordmark is not shown.
Announcing it twice is worse than not announcing it.

### Icons are metadata files, and the failure mode is silence

`app/icon.png` and `app/apple-icon.png` are Next.js **file conventions** — the
framework finds them by path and emits the `<link>` tags itself. DELIBERATE:
there is **no `icons` key in `app/layout.tsx`'s metadata**, because adding one
suppresses the file convention entirely: you get exactly the tags you listed and
none of the ones the framework would have generated.

Both are built, never hand-edited, by **`python3 scripts/build-brand-assets.py`**
— the 32px flat icon from `design/in-use/favicon-flat.png`, the 180px squircle
from `design/in-use/app-icon-squircle.png`.

A second script, `scripts/build-app-icon.py`, builds a different thing: the
PWA icons under `public/assets/app-icon/` (`192`, `512`, `1024`, each also
maskable). **Nothing in the app references them** — there is no web manifest —
so they are a built, documented, unwired set; if you add a manifest, they are
already there. `checks/app-icons-rebuilt.ts` asserts they come from the master
and that the build is byte-reproducible.

### The mascot has states, and each state has one job

Each illustration is mapped to the situation it belongs in. A mascot that shows
the same face for "you have no data yet" and "the request failed" is worse than
no mascot, because it signals that the product is not reading the situation
either.

| Illustration | Shown when | Where |
|---|---|---|
| `state-empty` | nothing has been created here yet | lists and detail pages |
| `state-welcome` | a first-run surface you are meant to populate | the Settings panels you fill |
| `state-notfound` | we looked and found nothing — a 404, or filters that match none | 404s and filtered-out lists |
| `state-error` | a failure the user did not cause | `error.tsx`, `Query` |
| `state-thinking` | waiting on an answer | `KnowledgeAsk` only |
| `state-approved` | an approval succeeded — the platform's signature act | `ApproveAction` toast |
| `state-goodbye` | signed out | `signed-out` |
| `mascot-hero` | the login screen | `login` |

`checks/mascot-assignment.ts` holds every row — exhaustively for the
`EmptyState` sites, and by pinning each one-off surface to the single file
allowed to use it.

**`state-thinking` is the one substitute for a spinner**, on the one screen
where a person waits on an answer rather than on a button. Everywhere else, busy
is `Spinner` or `Skeleton` (§4). There is no `state-working`: an illustration
that appears for 400ms and vanishes is a flicker, not reassurance.

**Not every empty surface gets a mascot, and the line is size.** A whole pane
standing empty gets one — that much dead space needs something in it, and the
illustration is what makes "filtered out" and "never written" distinguishable
before the words are read. A one-line placeholder does not: an empty row inside
a table whose headers are already visible, or the line above a composer you are
about to type into, says what it needs to in a sentence.

### Asset custody — `design/` is the master, `public/` is the derivative

```
design/in-use/       masters. Full resolution, committed, not shipped.
design/reference/    contact sheets. Provenance only.
public/assets/brand/ derived. What the browser actually downloads.
```

Everything in `public/assets/brand/` is generated by
`python3 scripts/build-brand-assets.py` from `design/in-use/`. The script
**refuses to upscale** — if a master is smaller than the target, it fails rather
than shipping a soft image.

`design/` is tracked in git (it is the master, and a master that lives on one
laptop is a master the team does not have) but it is listed in `.dockerignore`,
because source art in the build context only makes the image fatter.
`checks/asset-custody.ts` asserts that line, because the failure is invisible —
the image builds fine, just fatter.

**Never hand-edit anything under `public/assets/brand/`.** Edit the master, run
the script, commit both.

### The sparkle

One inline `<Sparkle />` on the active nav item. It is the system's single piece
of ornament and it is deliberate: the kit has personality, and a console that
adopts the palette and the mascot but keeps every surface perfectly inert reads
as a theme applied to someone else's product. `checks/sparkle-motif.ts` keeps it
to one place — the discipline is not that it exists, it is that it does not
spread.

---

## 3. The layout contract

There is one way to lay out a page, and `src/components/ui/layout.tsx` holds
every number in it. A page has no layout switches.

### The four rules

1. **One scroller.** `ShellBody` is the only element on a page that scrolls,
   and only vertically. No card, table, list, code block or tab strip scrolls
   on its own — in either direction.
2. **Cards are their content's height.** Every list that can pass ten rows pages
   (`usePaged` + `PageControl`, 10/20/30 rows). That is what caps a card's
   height, and it is why rule 1 can hold. A "top N" list stays capped at N.
3. **Four splits.** A page is a stack of rows. A row is one full-width card, or
   cards split `1/2`, `2/3`, `1/3` or `1/4` (`Row split=…`). Cards in one row are
   the same height. One card per cell: a second card is a second row.
4. **Two widths.** `data` for dashboards, lists and detail pages — it fills the
   window, less the rail and the gutter, with no cap. `reading` (832px) for a
   document, a form or prose, and that one centres.

### The nesting

```
AppShell              fixed inset-0 · the document never scrolls
├─ sidebar rail       its own scroll (navigation, not the page)
└─ main column
   ├─ ShellHeader     never moves · content aligned to the page column
   ├─ ShellSubNav     optional · never moves
   └─ ShellBody       the scroll region — vertical only
      └─ content      mx-auto · max-width by `width` (the gutter is on ShellBody)
         └─ Stack     rows, one gap apart
            ├─ Row 1/4    metric tiles (DashboardPage `metrics`)
            ├─ Panel      a full-width card
            └─ Row 1/2    two equal cards
```

`DashboardPage` is what a page uses: `PageFrame` + `Stack` + the metric row,
plus the freshness stamp and period picker.

### The numbers, and where they come from

| | value | borrowed from |
|---|---|---|
| gutter | 16 → 24 → 32px at `<768` / `md` / `xl` | Atlassian (16px to 1024, 32px after), Material 3 (16px compact, 24px from 600) |
| gap between cards and rows | 16 → 24px at `xl` | Atlassian desktop gutter 16px, Material pane spacing 24px |
| `data` width | the window, uncapped | see below |
| `reading` width | 832px | Atlassian fixed-narrow (864px incl. margins); ~90 characters of body text |

DELIBERATE: `data` is uncapped. A fixed container answers "how wide should a column
of prose be". A console table answers a different question: it carries many
columns, several of them paths and slugs that elide, and for that the honest width
is the one the person chose when they sized their window. The gutter still holds
content off the frame, and the header band and the body share one left edge at
every width because all three bands compose the same constant. `reading` stays
capped: a form stretched across 2500px is a different defect.

### The page shapes

| shape | rows, top to bottom | pages |
|---|---|---|
| Dashboard | metrics · a full-width chart · `1/2` | Overview, Runs |
| List | metrics (optional) · one card: toolbar + paged table | Initiatives, Teams, People, Activity, Knowledge |
| Detail | metrics · the main list, full width · supporting cards in `1/2` or `2/3` | a team, an initiative, a plugin |
| Reader | `width="reading"` · the document flows, the page scrolls | a document, Settings |

A short page ends where its content ends, and the ground below it is page
ground. Stretching cards to fill the window only moves that space inside a
bordered box, which reads as a rendering bug.

### Fitting without sideways scroll

A table wider than its card has too many columns for that width. Put
`hideBelow="md" | "lg" | "xl" | "2xl"` on the least important columns' head
**and** cells. It reads the window width, not the card's, so a table in a `1/2`
or `reading` card is fitted by carrying fewer columns in the first place. Long
identifiers `truncate` (with a `title`) or `break-all`; `<pre>` wraps
(`whitespace-pre-wrap`); chip rows and tab strips `flex-wrap`.

### Enforced

- `checks/one-scroller.ts` — no `overflow-*-auto|scroll` outside the shell, and
  no `grid-cols-*` under `app/(dash)`: page grids are `Row`s.
- `tests/page-layout.test.tsx` — one scroller and the gutter, for every
  combination of width × metric row × sub-nav; the splits stack below `lg`.

### The head zone

`PageFrame`'s header is a three-zone band read left→right: **breadcrumb + title**
(identity), **`description`** (the head-note, right-aligned), **`actions`**.

The head-note sits on the title's baseline rather than at the top of the scroll
body. A description in the body reads as the first paragraph of the content: it
scrolls away, it competes with the first panel's own title, and it pushes every
panel down by a line. Bound to the title it is a caption on the page. The zones
share a bottom edge, which is what makes the band read as a masthead instead of a
toolbar.

### Verifying it

```bash
pnpm dev
pnpm add -D puppeteer            # once
AUDIT_BASE=http://127.0.0.1:3000 pnpm audit:layout
```

`scripts/layout-audit.ts` drives a real browser at three viewport sizes and
asserts the structural invariants — the document never scrolls, nothing is
clipped, the page body actually moves, the header stays put, every control has
an accessible name, no panel collapsed to a sliver, tables fit.

The characteristic failure of this system is **broken and green**: TypeScript
passes, tests pass, the page returns 200, and a screenshot looks plausible
because the visible rows are correct. Run it before shipping a new page shape.

---

## 4. Component catalogue

### `@/components/ui` — primitives

| Group | Components |
|---|---|
| Foundation | `Button` `Card` (+`CardHeader`/`CardTitle`/`CardContent`) `typography` |
| Forms | `Field` `FieldGrid` `Input` `Textarea` `Select` `Switch` `Segmented` `SearchInput` `field-styles` |
| Display | `Table` `Badge` `Banner` `EmptyState` `MetricCard` `Spinner` `Tooltip` |
| Overlay & nav | `Breadcrumb` `TabBar` `NavTabs`¹ `Toolbar` |
| Layout | `AppShell` `PageFrame` `Stack` `Row` |
| Feedback | `showToast` / `Toaster`¹ |

A row in this table has an importer behind it. Add a primitive the moment a
screen needs it, not before: a design system's inventory is read as permission
to reach for what it lists.

¹ Not in the barrel — import by path (`@/components/ui/toast`,
`@/components/ui/nav-tabs`). DELIBERATE: giving them two valid import paths is
how a module ends up mounted twice.

`Field` owns the accessibility wiring — `htmlFor`, the generated id,
`aria-describedby`, `aria-invalid`. Pass the control as a render prop:

```tsx
<Field label="Email" hint="We never share it." error={err} required>
  {(p) => <Input type="email" {...p} />}
</Field>
```

### `@/components/patterns` — compositions

| Component | Use |
|---|---|
| `FormPanel` | **the** form shell — heading, fields, error line, owned footer |
| `ProseBlock` | sanitised markdown, themed to the tokens |
| `DocumentShell` | long-form document layout |

### Data freshness and busy states

**`Freshness`** — the "Updated 4 min ago" stamp in the head zone. Pass
`updatedAt` to `DashboardPage` on every page whose data has a refresh cadence.
A stalled pipeline and a quiet Tuesday both render as a flat line — only the
timestamp tells them apart. `staleAfterMs` is the contract: past it the stamp
turns amber and says `stale`. `null` means never refreshed and says so.

Read `updatedAt` from when the data arrived, never from `now()` — a clock read
at render time can never expose a pipeline that stopped. Pass `now` on a
fixed-clock page: a relative timestamp derived from `new Date()` is evaluated
once on the server and again on the client, and at a rollover boundary the two
render different text.

**`Skeleton`** — one loading vocabulary. Anything that occupies layout while it
loads gets a skeleton shaped like the thing that is coming; anything that is a
discrete action gets `Spinner`. Never both in one place: a product where one
screen spins and the next shows skeletons never teaches the reader what "busy"
looks like.

Skeletons are built from the same `Row` / `Card` primitives as the real
screens, so the page does not jump on arrival. `app/(dash)/loading.tsx` covers
the group; a route whose shape differs enough to jump gets its own.

### `EmptyState` and `showToast` take an optional illustration

```ts
illustration?: { src: string; width: number; height: number }
```

DELIBERATE: `EmptyState`'s `icon` prop stays **required**. The illustration is
additive: the icon is the fallback for a failed image.

For `showToast` the illustration is optional and almost never passed:
`ApproveAction` sends `state-approved.png`, because approving is this platform's
signature act; every other call site takes the default `CheckCircle2` /
`XCircle` branch.

### `@/components/charts`

Hand-drawn SVG and CSS — **no charting library**, on purpose. A library ships
its own colour scale and type ramp, and the dashboard then carries two design
systems that drift apart. These read the palette through CSS variables, so a
rebrand recolours the charts too.

| Chart | Shape |
|---|---|
| `TrendChart` | time series; any mix of `area` / `line` / `bar` series. Bars get their **own** scale in a bottom band — a count and a rate on one axis flattens whichever is smaller |
| `BarList` | ranked horizontal bars ("by endpoint", "by person"), with a `limit` + "others" row |
| `CompositionBar` | a single 100% stacked bar |
| `ActivityHeatmap` | weekday × hour grid, linear intensity ramp |

Every chart emits an **`sr-only` table** of the same numbers. The tooltip is
mouse-only, so the table is the only way the data is otherwise reachable.
Mandatory — if you fork a chart, the table forks with it.

> `TrendChart` is `'use client'`, so its series config names its formatter
> (`format: 'cost'`) rather than carrying a function. A function prop from a
> server component throws *"Functions cannot be passed directly to Client
> Components"*. See `NumberFormat` in `@/lib/format`.

### `@/components` — app shell pieces

`Sidebar` (renders `@/nav`, and owns the one `Sparkle`), `AppMark`,
`DashboardPage`, `Panel`, `PeriodSelect`, `Providers`.

---

## 5. Conventions

**Formatters.** Every number goes through `@/lib/format`. They all accept
`null` and render `—`. Never coerce: "we measured zero" and "nobody measured"
are different facts.

**Dates.** Every date goes through `@/lib/format-date`. Nothing calls
`toLocaleDateString` directly. `DISPLAY_TIMEZONE` is a cross-cutting invariant,
not a preference — bucket server-side on the same boundary or the chart and the
totals disagree by a day at the edges.

**Colour by token, not by hex.** Chart series take a `Tint` name from
`@/lib/tints`, the single place the cycle is declared. Eight tints exist —
`accent` `lavender` `pink` `blue` `sage` `amber` `rose` `steel` — but the
categorical cycle is only the first four. `sage`/`amber`/`rose` remain available
to pass explicitly when the colour means something; `tintFor(i)` never returns
one. Every tint fill also carries `CHART_EDGE`.

**Panels, not bare Cards.** Reach for `Panel` unless the surface genuinely has
no title. `padded={false}` when a table or full-bleed list lives inside. A
table that does not fit drops columns with `hideBelow` — nothing scrolls sideways.

**URL as state.** The period lives in `?period=`, so a scoped view is linkable,
refreshable, and readable by a server component with no client round-trip.

---

## 6. Measuring craft

Three questions, three tools. The layout audit asks *is it broken?*;
`audit:design` asks *is it disciplined?*; `verify:contrast` asks *is it legible?*
— and only the last one can fail your build.

```bash
pnpm verify:contrast     # every enumerated pair, formula-checked, exits non-zero
pnpm audit:design        # discipline counters, advisory
```

**`pnpm run gate` runs `verify:contrast` and every check under `checks/`.** A
check nobody runs is not a check, so both sit on the release path rather than in
a script a person has to remember.

`verify:contrast` enumerates each pair by name — `--ink` on `--surface`,
`--on-accent` on `--accent`, `--red-text` on `--red-tint`, and so on — so a
token that moves fails loudly, with the pair named and the measured ratio
printed. It shares one formula with the browser audit: `scripts/lib/contrast.ts`
is the module, and `checks/contrast-formula-agrees.ts` asserts the two copies
agree to 1e-9. (They have to be two copies — the audit's version is serialised
into the browser by Puppeteer and cannot be imported.)

| Measure | Budget |
|---|---:|
| Distinct type sizes | 7 |
| Distinct weights | ≤4 |
| Distinct radii | ≤5 |
| Off-scale spacings | 0 |
| Enumerated contrast pairs passing | all |
| Hierarchy ratio, analytical pages | ≥3× |

DELIBERATE: `--line-strong` on `--surface` is not an enumerated pair. It is a
decorative hairline, not a control and not a meaningful graphic, so 1.4.11 does
not reach it — a border you can barely see is the point of a border you can
barely see. The reasoning is written at the exclusion.

**Then look with your eyes.** No metric catches incoherence — two neutrals, two
label treatments, two radii that are each individually defensible. Only seeing
the thing at once does.

### Run them with `pnpm checks`

`pnpm checks` runs all nineteen and prints `19/19`. Run it rather than looping
over `checks/*.ts` in a shell: `scripts/run-checks.ts` declares the expected list
**literally** rather than deriving it from `readdir`, so a declared check that is
missing and an undeclared one that appears both fail. A shell loop can only count
what is on disk.

### A check you have not tried to break is a check you are guessing about

`doc-counts.ts` checks this page: the counts it states are derived from the code
and compared against the prose. A claim that cannot be derived is not in that
check — it measures arithmetic, not judgement.

**When you add a check here, break the thing first and watch it go red.** A check
satisfied by something already in the file for an unrelated reason — a regex that
matches its own docstring, an allowlist that exempts a whole file, a proximity
window that catches an unrelated element — keeps passing while the invariant rots
around it. A check written against a defect you just fixed is a regression test
wearing an invariant's name.

### Look at every page — the real one

Two traps produce a screenshot that looks plausible and is not the product:

- **`output: 'standalone'` does not copy `public/` or `.next/static`.** The
  `Dockerfile` does it explicitly; run the standalone server locally without
  repeating those two copies and every image 404s.
- **A rebuild re-hashes every chunk, and the standalone copy keeps the old
  names.** Anything that runs `pnpm build` — `checks/icon-convention.ts` does,
  by design — leaves an already-running standalone server serving HTML that
  points at chunks it no longer has. The JS 500s, nothing hydrates, and every
  page sits on "Checking your sign-in…" forever.

Guard the sub-resources, not only the document, or re-copy and restart after
every build.

**The still frame is not the whole product.** The approve toast lives for
3000ms after a click that mutates state, so no page-load harness can contain it;
`tests/approve-action.test.tsx` holds it. Anything transient needs a test that
drives it. A page that returns 200 is not a page that looks right.

## 7. Provenance

**The brand.** The ZZ kit — wordmark, mascot, palette, the whole cast of states
— is commissioned source art, not a template and not stock. The masters are in
`design/`, and the contact sheets that show what was delivered (including the
pieces not adopted) are in `design/reference/`.

**The system.** Extracted from two production apps that share this system; the
UI kit comes from the richer of the two, and `shell.tsx` and `globals.css` from
the other. Domain-specific components — stage rails,
audit findings, SDLC navigators — were left behind on purpose.
