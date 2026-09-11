# Design system

The whole system in one page: the tokens, the layout contract, the component
catalogue, and the four mistakes that render without an error and simply look
wrong.

---

## 1. Tokens

Everything visual resolves to a CSS custom property in `app/globals.css`. There
are three layers, and you should only ever edit the first two.

### The neutral ramp

One cool-grey ramp. Every grey in the product is a rung on it — which is what
stops "a slightly different grey" from being invented at a call site.

`--n-0` `--n-25` `--n-50` `--n-100` `--n-150` `--n-200` `--n-300` `--n-400`
`--n-500` `--n-600` `--n-700` `--n-800` `--n-900`

### Brand and status

**One accent.** `--indigo` / `--indigo-deep` / `--indigo-tint`. It marks the
primary action, the active nav item, the focus ring, and the single number on a
page that carries the finding. That is the whole list.

**Three reserved status hues** — `--green` / `--amber` / `--red`. They mean
good / warn / bad, and nothing else may use them. They carry all the semantic
weight in the product precisely because nothing else competes with them.

Each hue has a **FILL** tone and a **TEXT** tone (`--green` vs `--green-text`).
Paint with the fill, write with the text tone. A fill that reads perfectly as a
4px dot fails at 4.5:1 as 11px type — that mismatch has been the source of every
contrast failure this system has had.

### Filled surfaces need a foreground token

`--on-accent`, `--on-danger`, `--danger-fill`.

A filled button's label colour is **not a constant**. In light the fill is dark
so the label is white; in dark the fill is a *light* indigo and white on it
measures 3.05:1. Hard-coding `text-white` on a button is the single most common
way a dark theme ships broken, because it looks perfect in the theme it was
written in.

### Semantic tokens — what components actually reference

| Token | Means |
|---|---|
| `--bg` / `--bg-sunk` | page ground / recessed ground |
| `--surface` / `--surface-2` | card surface / secondary surface |
| `--ink` / `--ink-soft` / `--ink-faint` | primary / secondary / tertiary text |
| `--line` / `--line-strong` | hairline / emphasised border |
| `--accent` / `--accent-deep` / `--accent-tint` | brand, its dark variant, its wash |

**Rebrand by repointing these**, not by editing components.

### What this replaced, and why

A warm cream-and-ember palette. It was internally consistent, it passed every
audit, and it still read as a magazine rather than a product. Two reasons, and
they generalise:

1. **The ground itself was coloured.** A tinted canvas means the accent is
   fighting a coloured background everywhere it appears, and colour ends up
   decorating the page instead of meaning anything on it.
2. **Colour was doing a job that structure should do.** Every professional
   dashboard worth copying resolves this the same way: near-neutral surfaces,
   one measured brand colour, status hues reserved. If a surface is coloured,
   ask what it is telling you — if the answer is "nothing", make it neutral.

### Geometry

`--r-sm: 4px` (badges) · `--r: 6px` (controls) · `--r-md: 8px` ·
`--r-lg: 10px` (panels) · full-round only where roundness carries meaning.

These were 2/3/4 in an earlier pass — near-square, which reads brutalist rather
than precise, and was the single change that most made the build look severe.
The values above are measured off the systems this is modelled on.

### Elevation — hairlines, not shadows

In-page surfaces get **no shadow**. They are separated by hairlines and by
space, which is what the reference systems do. Only things that genuinely float
— menus, popovers, dialogs, toasts — get `--shadow-pop`.

### The surface weight ladder

`<Card weight>` has four steps:

| weight | treatment | use |
|---|---|---|
| `flat` | no boundary | grouping by space alone — reach for it first |
| `default` | hairline | a real object with a real edge |
| `soft` | tinted fill, no border | quiet context beside the main content |
| `hard` | 2px ink edge | the single most important object. One per screen. |

Whitespace groups before borders do.

### Dark mode

Shipped from day one, not bolted on. `globals.css` defines the palette three
times: bare `:root` (light), a `prefers-color-scheme` block guarded with
`:root:not([data-theme='light'])` (system), and `:root[data-theme='dark']` (the
explicit choice). `ThemeToggle` sets one attribute; an inline script in
`app/layout.tsx` applies the stored choice **before first paint**, without which
the page flashes light and corrects itself on hydration.

The inversion is **not symmetric**. Dark surfaces step *up* toward the reader
while light surfaces step *down*, and the accent has to lighten or it disappears
into the ground. Mirroring the ramp mechanically is what produces a dark mode
that looks muddy.

Measure both themes: `AUDIT_THEME=dark pnpm audit:design`. Almost every palette
mistake is invisible in the theme it was designed in.

### Tailwind mapping — `@theme inline`

A colour is only usable as a utility if it is listed in the `@theme inline`
block. `--color-sage-deep: var(--sage-deep)` is what makes `text-sage-deep`
emit CSS.

> **This fails silently.** A class whose colour is not mapped emits *no CSS at
> all* — the element keeps its inherited colour and the page looks merely
> "slightly off". Adding a raw variable is half the job; map it too.

### Theming a mode

Remap the semantic layer under an attribute. Because the mapping is
`@theme inline`, utilities resolve the live variable and every component swaps
with no JS branch and no re-render:

```css
[data-env='production'] {
  --bg: var(--ice-paper);
  --surface: var(--frost-2);
  --ink: var(--ice-ink);
  --accent: var(--steel);
  --accent-deep: var(--steel-deep);
  --accent-tint: var(--frost);
}
```

Set `data-env` on any ancestor. The apps this was extracted from used exactly
this to swap a whole project view warm→cool by lifecycle phase.

### Type — two families, eight sizes

**Inter** for everything, **JetBrains Mono** for identifiers and code. There is
no serif. A serif headline reads as editorial voice, and an interface has a
hierarchy rather than a voice — hierarchy comes from weight, size and tracking.

| px | name | role | class |
|---|---|---|---|
| 40 | stat | the dominant number | `.t-stat` |
| 32 | display | the largest heading | `.t-display` |
| 22 | title | page and section headings | `.t-title` |
| 16 | lead | panel titles | `CardTitle` `.t-heading` |
| 14 | body | prose, table cells, controls | `.t-body` `.t-label` |
| 12 | small | captions, meta, dense cells | `.t-sm` `.t-mono` |
| 11 | label | uppercase eyebrows | `.t-eyebrow` |
| 10 | micro | axis ticks, legends | `.t-micro` |

Three weights — 400 body, 500 labels and controls, 600 headings and stats.
Four is the ceiling.

**Tracking is not decoration.** Large type gets `-0.022em`; without it big
numerals set loose and read as a price tag. That one value is most of what makes
display type look drawn rather than typed.

**Mono is for identifiers and code only.** It had spread to metric labels,
table headers and status stamps, where at that density it stops reading as an
annotation and starts reading as a stylistic tic.

**Never shrink type to fit. Cut words instead.**

### One dominant object

A page should have exactly one thing the eye lands on first, and the ratio
between it and the body text measures whether it does. `pnpm audit:design`
reports it. Analytical pages should be **3× or better**; the Overview is 3.67×
and Activity is 4×. A page whose largest text is 20px against a 15px median has
no hierarchy — it has a rounding error.

Pages whose dominant object is a TABLE or a FORM (Records, Settings) legitimately
score lower: the object carrying the page is not type.

### Colour discipline

- **One accent per view.** `MetricCard emphasis` marks the single tile carrying
  the finding; `BarList highlight` marks the single bar worth pointing at.
  Everything else is the neutral population.
- **The status trio is reserved.** `sage` / `amber` / `rose` mean good / warn /
  bad. Never use them as chart series colours.
- Soft fill + strong border is the house pattern for a tinted object.

---

## 2. The layout contract

This is the load-bearing part. Get it wrong and the page renders without an
error and looks broken.

### The root lock

The document **never scrolls**. `AppShell` is `fixed inset-0`; the only scroll
region is `ShellBody`, reached through `PageFrame`. `html` and `body` are
`h-full` and the root is overflow-locked in `globals.css`.

### The nesting

```
AppShell            fixed inset-0 · owns the sidebar rail
└─ ShellHeader      static row, never moves
└─ ShellBody        THE scroll region
   └─ PageFrame     title · description · actions · breadcrumb · subnav
      └─ StatusDashboard   metric row + 2/3 · 1/3 split
         ├─ primary (2/3)
         └─ aside   (1/3)
```

`PageShell` is the master-detail preset over `StatusDashboard`.
`DashboardPage` is the preset over *that*, and is what a page should normally
use — it fixes `width="full" fill` and wires the period picker.

### The four props that matter

| Prop | Set it when | If you get it wrong |
|---|---|---|
| `PageFrame fill` | the panels below scroll themselves | `PageShell`'s `h-full flex-1` has no bound; the grid collapses to content height |
| `StatusDashboard scroll="outer"` | the panel **stacks** several cards | a stack of cards is crushed or clipped |
| `StatusDashboard scroll="inner"` | one self-scrolling child (a `fill` DataTable) | the table grows to content height and is clipped with no scrollbar |
| `StatusDashboard align="start"` | a short rail beside a tall form (settings) | the rail stretches to match the form and floats in empty space |

`scroll` and `align` are deliberately **independent**. Coupling them leaves
every `align="start"` page with no scroller at all.

### Rails

- `RailNote` is **guidance**, never a panel. It always wraps its own content —
  the shell stretches the rail's *last* child, and a stretched note becomes a
  huge tinted block of empty space under three lines of text.
- A page with neither `note` nor `rail` renders **full width**. That is what a
  wide table wants; `app/(dash)/initiatives` is one.

### The head zone

`PageFrame`'s header is a three-zone band read left→right: **breadcrumb + title**
(identity), **`description`** (the head-note, right-aligned), **`actions`**.

The head-note sits on the title's baseline rather than at the top of the scroll
body. A description stranded in the body reads as the first paragraph of the
content: it scrolls away, it competes with the first panel's own title, and it
pushes every panel down by a line. Bound to the title it becomes what it is — a
caption on the page, not content in it. The zones share a bottom edge, which is
what makes the band read as a masthead instead of a toolbar.

### Verifying it

```bash
pnpm dev
pnpm add -D puppeteer            # once
AUDIT_BASE=http://127.0.0.1:3000 pnpm audit:layout
```

`scripts/layout-audit.mjs` drives a real browser at three viewport sizes and
asserts ten structural invariants — the document never scrolls, nothing is
clipped, every scroller actually moves, the header stays put, every control has
an accessible name, no panel collapsed to a sliver, tables are reachable.

This exists because the characteristic failure of this system is **broken and
green**: TypeScript passes, tests pass, the page returns 200, and a screenshot
looks plausible because the visible rows are correct. Run it before shipping a
new page shape.

---

## 3. Component catalogue

### `@/components/ui` — primitives

| Group | Components |
|---|---|
| Foundation | `Button` `Card` (+`CardHeader`/`CardTitle`/`CardContent`) `typography` |
| Forms | `Field` `FieldGrid` `Input` `Textarea` `Select` `Switch` `Segmented` `SearchInput` `field-styles` |
| Display | `Table` `Badge` `Banner` `EmptyState` `MetricCard` `MetricRow` `Spinner` `Tooltip` |
| Overlay & nav | `Breadcrumb` `TabBar` `NavTabs`¹ `Toolbar` |
| Layout | `AppShell` `PageFrame` |
| Feedback | `showToast` / `Toaster`¹ |

**Thirteen primitives left this table on 2026-09-11 and the code is why.** `DataTable`,
`DropdownMenu` (six exports), `AvatarGroup`, `Avatar`, `Split`, `Section`, `IconButton`,
`Checkbox`, `Grid`, `Separator`, `CardFooter`, `Lead` and the two `Stat` rows were each
defined once and imported by nothing — several of them named in five or six other files, every
mention a comment. A design system's inventory is the one document where listing something
nobody uses is worst: it is read as permission to reach for it.

Add one back the moment a screen needs it. What must not come back is a row in this table with
no importer behind it.

¹ Not in the barrel — import by path (`@/components/ui/toast`,
`@/components/ui/nav-tabs`). Deliberate: giving them two valid import paths is
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
| `StatusDashboard` | the metric row + 2/3·1/3 split. The layout primitive. |
| `PageShell` | master-detail preset over it |
| `FormPanel` | **the** form shell — header, fields, owned footer. Two switches: `inline` (drop the Card, for a table row) and `disclosure` (read view until opened, for credentials) |
| `RailNote` | rail guidance (markdown or rich children) |
| `ProseBlock` | sanitised markdown, themed to the tokens |
| `DocumentShell` | long-form document layout |
| `VerifyResultBox` | the "did the live check pass" box (`FormPanel`'s `validate` renders it) |

### Data freshness and busy states

Two things a dashboard is judged on that are easy to leave out entirely:

**`Freshness`** — the "Updated 4 min ago" stamp in the head zone. Pass
`updatedAt` to `DashboardPage` on every page whose data has a refresh cadence.
A dashboard that does not say how old its numbers are cannot be trusted, and a
stalled pipeline and a quiet Tuesday both render as a flat line — only the
timestamp tells them apart. `staleAfterMs` is the contract: past it the stamp
turns amber and says `stale`. `null` means never refreshed and says so.

Read `updatedAt` from the STORE (the max ingest timestamp), never from
`now()` — a clock read at render time can never expose a pipeline that stopped.
Pass `now` on a fixed-clock page: a relative timestamp derived from `new Date()`
is evaluated once on the server and again on the client, and at a rollover
boundary the two render different text.

**`Skeleton`** — one loading vocabulary. Anything that occupies LAYOUT while it
loads gets a skeleton shaped like the thing that is coming; anything that is a
discrete action gets `Spinner`. Never both in one place. A product where one
screen spins, the next shows skeletons and a third dims behind an overlay never
teaches the reader what "busy" looks like, so every one of them reads as a
possible failure.

Skeletons are built from the same `MetricRow` / `Card` primitives as the real
screens, so the page does not jump on arrival — a skeleton that resolves into
something a different size is worse than no skeleton. `app/(dash)/loading.tsx`
covers the group; a route whose shape differs enough to jump gets its own.

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

`Sidebar` (renders `@/nav`), `AppMark`, `DashboardPage`, `Panel`, `Stat`,
`PeriodSelect`, `Providers`.

---

## 4. Conventions

**Formatters.** Every number goes through `@/lib/format`. They all accept
`null` and render `—`. Never coerce: "we measured zero" and "nobody measured"
are different facts, and a dashboard that conflates them is lying.

**Dates.** Every date goes through `@/lib/format-date`. Nothing calls
`toLocaleDateString` directly. `DISPLAY_TIMEZONE` is a cross-cutting invariant,
not a preference — bucket server-side on the same boundary or the chart and the
totals disagree by a day at the edges.

**Colour by token, not by hex.** Chart series take a `Tint` name
(`accent` · `sage` · `amber` · `rose` · `steel`) from `@/lib/tints`, which is
the single place the palette cycle is declared.

**Panels, not bare Cards.** Reach for `Panel` unless the surface genuinely has
no title. `padded={false}` when a table or full-bleed list lives inside — it
also adds the horizontal scroll affordance, so a wide table can never be
silently cut off.

**URL as state.** The period lives in `?period=`, so a scoped view is linkable,
refreshable, and readable by a server component with no client round-trip.

---

## 5. Measuring craft

`pnpm audit:design` drives a browser over every page — **in a named theme** —
and counts the things that make a UI look unsystematised. The layout audit asks
*is it broken?*; this asks *is it disciplined?*

```bash
AUDIT_THEME=light pnpm audit:design
AUDIT_THEME=dark  pnpm audit:design
```

| Measure | Budget | Current |
|---|---:|---:|
| Distinct type sizes | 8 | **8** |
| Distinct weights | ≤4 | **3** |
| Distinct radii | ≤5 | **5** |
| Off-scale spacings | 0 | **0** |
| Contrast failures, light | 0 | **0** |
| Contrast failures, dark | 0 | **0** |
| Hierarchy ratio, analytical pages | ≥3× | **3.6–4×** |

Run BOTH themes. When the palette was reworked, light came out at 0 failures
and dark at 7 — every one of them a filled button whose label was hard-coded
`text-white`, unreadable on a light accent fill, and completely invisible to
anyone reviewing in light. A one-theme audit is how a dark mode ships broken.

**And look at `/components`.** No metric catches incoherence — two greys, two
label treatments, two radii that are each individually defensible. Only seeing
every primitive at once does, which is why the gallery is a route in the app
rather than a separate Storybook: on the real ground, in the real shell, in the
theme you are actually looking at.

## 6. Provenance

Extracted from two production apps that share this system. The UI kit is taken
from the richer of the two; `shell.tsx`, `status-dashboard.tsx` and
`globals.css` are taken from the other, which carries later fixes (the flex-crush
guards, the rail-less-branch height bound) and no app-specific coupling.

Domain-specific components were left behind on purpose — stage rails, audit
findings, SDLC navigators. If you are diffing against an upstream app, that is
why those files are absent.
