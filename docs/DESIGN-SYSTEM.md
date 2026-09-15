# Design system

The whole system in one page: the tokens, the layout contract, the component
catalogue, and the four mistakes that render without an error and simply look
wrong.

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

Nine rungs, down from thirteen. The four that went (`--n-150`, `--n-400`,
`--n-600`, `--n-800`) had no semantic token pointing at them, and a rung nothing
maps to is a licence to invent a grey.

**The three ink rungs are derived, not picked.** `--c-500` was `#7a7080` by eye
and measured 4.16:1 on `--surface` against a 4.5:1 floor. It is now the same hue
re-derived until it passes — 5.41 on surface, 4.91 on bg, 4.78 on the tint. Pick
by eye, verify by formula, ship the verified value.

### Brand and status

**One accent.** `--zz-purple` `#7548d8` / `--zz-purple-deep` / `--zz-purple-tint`,
reached through `--accent` / `--accent-deep` / `--accent-tint`. It marks the
primary action, the active nav item, the focus ring, and the single number on a
page that carries the finding. That is the whole list.

**Three kit pastels** — `--zz-lavender` `--zz-pink` `--zz-blue`. These are the
brand's own secondary hues and they exist for ONE job: the categorical chart
cycle, where the series carry no ranking and the colour is a label. They are not
semantic, they never mean good or bad, and they are never a text colour — see
"Chart pastels are exempt from the contrast gate" below.

**Three reserved status hues** — `--green` / `--amber` / `--red`. They mean
good / warn / bad, and nothing else may use them. They carry all the semantic
weight in the product precisely because nothing else competes with them.

Each hue has a **FILL** tone and a **TEXT** tone (`--green` vs `--green-text`).
Paint with the fill, write with the text tone. A fill that reads perfectly as a
4px dot fails at 4.5:1 as 11px type — that mismatch has been the source of every
contrast failure this system has had.

### Filled surfaces need a foreground token

`--on-accent`, `--on-danger`, `--danger-fill`.

A filled button's label colour is **not a constant** — it belongs to the fill,
not to the theme. `--on-accent` is white because white on `--accent` measures
5.71:1; `--on-danger` is white because white on `--danger-fill` measures 5.92:1.
Hard-code `text-white` and the button is correct by luck: repoint `--accent` to
a lighter hue during a rebrand and every one of those labels silently drops
below 4.5:1 with nothing failing.

This mattered acutely when there were two themes — a light accent fill in dark
mode put white at 3.05:1 and it was invisible to anyone reviewing in light. One
theme removes the trap; it does not remove the reason the token exists.

### Semantic tokens — what components actually reference

| Token | Means |
|---|---|
| `--bg` / `--bg-sunk` | page ground / recessed ground |
| `--surface` / `--surface-2` | card surface / secondary surface |
| `--ink` / `--ink-soft` / `--ink-faint` | primary / secondary / tertiary text |
| `--line` / `--line-strong` | hairline / emphasised border |
| `--accent` / `--accent-deep` / `--accent-tint` | brand, its dark variant, its wash |

**Rebrand by repointing these**, not by editing components.

### What this replaced, and why — read this before you argue with the ground

The history runs cream → neutral → cream, and both reversals were deliberate.

A warm cream-and-ember palette shipped first. It was replaced by a cool-grey one
on two arguments, which this page made at length and which were good:

1. **The ground itself was coloured**, so the accent fought a tinted background
   everywhere it appeared and colour decorated the page instead of meaning
   anything on it.
2. **Colour was doing a job that structure should do** — every dashboard worth
   copying uses near-neutral surfaces, one measured brand colour, reserved
   status hues.

The ground is cream again as of 2026-09. **What changed is the brief, not the
argument.** The ZZ brand kit has cream as its own primary, and the product owner
chose to carry the brand rather than to avoid the mistake. That is a legitimate
call and it is the one that was made.

The first argument turned out to be answerable by measurement rather than taste:
ink on this ground is **14.79:1** and the accent on it is **5.04:1**, so the
accent is not fighting anything. `scripts/verify-contrast.ts` holds all 31
pairs and exits non-zero.

The second argument survives untouched and is the load-bearing half. Colour is
still for MEANING. Green, amber and red still mean good, warn and bad. One
accent still marks one thing per view. What the kit added is three pastels for
the categorical chart cycle — a place where colour is a *label*, which is the
one honest non-semantic use.

**So: a coloured ground is a decision that was made with the numbers in hand.
Do not "fix" it back to grey.**

### Geometry

`--r-sm: 8px` (badges) · `--r: 10px` (controls) · `--r-md: 12px` ·
`--r-lg: 16px` (panels) · `--r-pill: 999px`.

The ladder has been 2/3/4, then 4/6/8/10, and is now 8/10/12/16. Near-square
read brutalist rather than precise; 4/6/8/10 read as a competent generic
dashboard. The kit's own geometry is soft, and the radii carry that further than
any single component does — this is the change you notice before you notice the
palette.

`--r-pill` is new and is **not** a fifth step on the ladder. It is a distinct
statement: full-round says "this is a token, a count, a state" — a badge, a
chip, a mascot's frame. Reach for it where roundness carries meaning, not where
you want a rounder rectangle. The distinct-radii budget is 5 and that is the
whole ladder, so a sixth value invented at a call site fails the audit.

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

### One theme. There is no dark mode — this is a removal, not a gap

**BREAKING, 2026-09.** Dark mode shipped from day one and has been deleted.
Gone: the `prefers-color-scheme` block, the `:root[data-theme='dark']` block,
`ThemeToggle`, `AppearancePanel`, the `<head>` pre-paint script that applied the
stored choice, and the stored choice itself. `globals.css` now defines the
palette exactly ONCE, in a bare `:root`.

**What breaks for you:** a user who had chosen dark gets cream on next load,
with no setting to change it back. Any `dark:` variant, any
`[data-theme='dark']` selector, and any `prefers-color-scheme` query you add
will render nothing and fail `checks/no-dark-mode.ts`.

Why, plainly: the kit is a cream identity with a mascot, and a dark inversion of
it is a different product wearing the same logo. A second theme that nobody had
designed to the same standard was a second surface for every palette decision to
be wrong on — which is exactly what the section this replaces warned about, from
the other side. One theme, measured once, is the cheaper honest answer.

The palette is now verified rather than emulated: `node scripts/verify-contrast.ts`
checks 31 enumerated pairs and exits non-zero. `pnpm audit:design` no longer
takes `AUDIT_THEME`.

### Tailwind mapping — `@theme inline`

A colour is only usable as a utility if it is listed in the `@theme inline`
block. `--color-sage-deep: var(--sage-deep)` is what makes `text-sage-deep`
emit CSS.

> **This fails silently.** A class whose colour is not mapped emits *no CSS at
> all* — the element keeps its inherited colour and the page looks merely
> "slightly off". Adding a raw variable is half the job; map it too.

### Theming a scope

Dark mode is gone; the MECHANISM that made it possible is not, and it is the
reason a rebrand is a token edit rather than a component sweep. Remap the
semantic layer under an attribute — because the mapping is `@theme inline`,
utilities resolve the live variable and every component swaps with no JS branch
and no re-render:

```css
[data-env='staging'] {
  --accent: var(--steel);
  --accent-deep: var(--steel-deep);
  --bg: var(--c-100);
}
```

Set `data-env` on any ancestor. The apps this was extracted from used exactly
this to swap a whole project view by lifecycle phase.

**Two rules if you do it.** Remap only the SEMANTIC layer — never a `--c-*`
rung, which is the ramp itself and would move every token pointing at it. And
whatever you remap must clear the same contrast floors: add the pairs to
`scripts/verify-contrast.ts`, because a scope nothing enumerates is a scope
nothing checks.

### Type — three families, seven sizes

**Rubik** for everything, **Baloo 2** for the two largest steps, **JetBrains
Mono** for identifiers and code. There is no serif. A serif headline reads as
editorial voice, and an interface has a hierarchy rather than a voice.

Rubik replaced Inter. Inter is the correct neutral choice and that is the
problem — it is what every dashboard is set in, so it contributes nothing to an
identity. Rubik is a workhorse UI face with slightly rounded terminals that sits
with the kit's geometry instead of against it, and it holds at 11px, which is
the real test.

**Baloo 2 is used at exactly two sizes and nowhere else** — `.t-stat` (40px) and
`.t-display` (32px), bound through `--font-display-family`. It is a rounded
display face and it is the *character* in the type system: at 40px it makes a
number feel drawn, at 14px it would make the product look like a children's app.
The ceiling is deliberate. Do not reach for it for a panel title.

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

**Seven rungs, eleven classes.** The classes outnumber the sizes because a name
says what a thing IS, and two things at the same size can be different things:
`.t-eyebrow` and `.t-micro` are both 11px, `.t-body` and `.t-label` both 14. That
is deliberate — renaming one does not resize it. What is NOT allowed is an eighth
rung.

This table said *eight* sizes and gave `.t-micro` as 10px. It is 11px, and has
been for as long as the class has existed.

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

- **One EMPHASIS per view, and identity is a different register.** `MetricCard
  emphasis` marks the single tile carrying the finding; `BarList highlight` marks
  the single bar worth pointing at. Everything else is the neutral population.

  Each metric tile also carries its own quiet `tint`, on the 32px icon chip and
  nowhere else. That is identity, not emphasis, and the two do not compete: the
  chip is a soft `--*-tint` ground under a `--*-deep` glyph, while the value is
  44px display type. This replaced a period where the tiles were uniform and
  their labels were uppercase mono, which itself replaced a six-way `iconTint`
  that let a page paint four saturated circles and made nothing stand out. The
  failure that time was SATURATION and SIZE, not variety — and the cure removed
  the wrong thing, taking the tile's one-line definition down into a tooltip with
  it. A definition most readers never open is not documentation.

  Only tints with a measured chip pair may be used: `CHIP` in `src/lib/tints.ts`
  is a map, not a template string, so a tint without one is a type error rather
  than a chip that silently renders grey.
- **The status trio is reserved.** `sage` / `amber` / `rose` mean good / warn /
  bad. **They are no longer in the categorical chart cycle** — that cycle is
  `accent` → `lavender` → `pink` → `blue`, four kit hues that carry no meaning.
  Using a status hue *with* meaning is still correct and still expected: the
  Overview's Event-kinds list passes `tint: k.failed ? 'rose' : undefined`, and
  a red bar there says "these failed", which is the hue doing its job. Two tiles
  take one for the same reason: Refusal rate is `rose` because refusals are bad,
  and Context pulled per run is `amber` because its own question is "is the
  system straining?". A tile that is merely neutral takes a kit hue.

  **A tile has no threshold state.** `tone="attention"` drew a rail in the tile's
  own hue and recoloured its title and number; it is gone, because a tile wearing
  it read as a different component rather than as this one, flagged — a fifth
  silhouette in a row of four. The chip stays IDENTITY and the delta pill stays
  DIRECTION, so neither replaces it: crossing a threshold now has no visual, and
  the number carries the tile. `emphasis` remains for singling one tile out, and
  is one per row.
- Soft fill + strong border is the house pattern for a tinted object.

### Chart pastels are exempt from the contrast gate — on purpose

`--zz-lavender`, `--zz-pink` and `--zz-blue` sit around 1.9–2.4:1 against the
surface. They are deliberately excluded from `scripts/verify-contrast.ts`, and
the exclusion is a design decision rather than an oversight:

- They are **never text and never a control.** They fill chart geometry only.
- WCAG 1.4.11's 3:1 floor targets controls and graphics whose *shape* carries
  meaning. A series' identity here comes from its legend, its label and its
  position — the fill is reinforcement.
- Darkening them to clear 3:1 gives four hues that all read as "dark purple" at
  a 4px bar width, which destroys the one thing a categorical palette is for.

What holds them accountable instead is `--chart-edge`
(`inset 0 0 0 1px rgba(34, 27, 38, 0.13)`): every pastel fill carries a hairline
so its BOUNDARY is always legible even where the fill is not. A pastel without
that edge is the bug. `checks/chart-series.ts` enforces the cycle.

**If you add a fifth series colour, it goes in the cycle AND it gets the edge —
and it does not go in the contrast script, which would then be lying about what
it checks.**

---

## 2. Brand — three marks, one mascot, and where the pixels live

### Three marks, and they are not scaled copies of one another

| Mark | File | Size | Why it is its own drawing |
|---|---|---|---|
| Wordmark `Zz` | `public/assets/brand/wordmark.png` | 22–30px, in-app | Sits beside the product name in the rail and reads as identity |
| Flat single `Z` | `app/icon.png` | 32px, browser tab | Two letters at 16px is mush. One letter survives |
| Mascot squircle | `app/apple-icon.png` | 180px, home screen | At 180px there is room for the character, and the character is the point |

**`AppMark` is the only place a mark is drawn in the application.** The previous
version of that file *claimed* that in its docstring and was not: only `Sidebar`
imported it, while `login`, `enrol` and `signed-out` each hand-drew their own
`ZZ` monogram — a hexagon in the rail and a lettermark on every auth screen, two
marks and no decision between them. `checks/one-mark.ts` now enforces it.

The image is decorative (`alt=""`); the accessible name comes from the `APP_NAME`
text beside it, or from an `sr-only` span when the wordmark is not shown.
Announcing it twice is worse than not announcing it.

### Icons are metadata files, and the failure mode is silence

`app/icon.png` and `app/apple-icon.png` are Next.js **file conventions** — the
framework finds them by path and emits the `<link>` tags itself. There is
deliberately **no `icons` key in `app/layout.tsx`'s metadata**, because adding
one SUPPRESSES the file convention entirely: you get exactly the tags you listed
and none of the ones the framework would have generated. That looks like it
works until you check the tab.

Both are built, never hand-edited, by **`python3 scripts/build-brand-assets.py`**
— the 32px flat icon from `design/in-use/favicon-flat.png`, the 180px squircle
from `design/in-use/app-icon-squircle.png`.

A second script, `scripts/build-app-icon.py`, builds a different thing: the
eight PWA icons under `public/assets/app-icon/` (`192`, `512`, `1024`, each also
maskable). **Nothing in the app references them today** — there is no web
manifest — so they are a built, documented, unwired set. That predates this
work and is left alone rather than half-deleted; if you add a manifest, they are
already there. `checks/app-icons-rebuilt.ts` asserts they come from the 1254px
master (not the old 183×179 crop) and that the build is byte-reproducible.

### The mascot has states, and each state has one job

**Nine assignments**, each mapped to the situation it belongs in. The mapping is
not decorative — a mascot that shows the same face for "you have no data yet"
and "the request failed" is worse than no mascot, because it signals that the
product is not reading the situation either.

| Illustration | Shown when | Where |
|---|---|---|
| `state-empty` | nothing has been created here yet | 6 sites, 5 files |
| `state-welcome` | a first-run surface you are meant to populate | the 6 Settings panels |
| `state-done` | a list is legitimately clear | `people` |
| `state-notfound` | we looked and found nothing — a 404, or filters that match none | 4 sites |
| `state-error` | a failure the user did not cause | `error.tsx`, `Query` |
| `state-thinking` | waiting on an answer | `KnowledgeAsk` only |
| `state-approved` | an approval succeeded — the platform's signature act | `ApproveAction` toast |
| `state-goodbye` | signed out | `signed-out` |
| `mascot-hero` | the login screen | `login` |

`checks/mascot-assignment.ts` holds all nine — exhaustively for the 18
`EmptyState` sites, and by pinning each of the four one-off surfaces to the
single file allowed to use it. (It used to enforce only the five `EmptyState`
assignments while this page documented all nine, which is precisely the
doc-outruns-the-check failure the rest of this page keeps warning about.)

**`state-thinking` is the one substitute for a spinner**, on the one screen
where a person waits on an ANSWER rather than on a button. Everywhere else, busy
is `Spinner` or `Skeleton` (§4). There is no `state-working`: an illustration
that appears for 400ms and vanishes is a flicker, not reassurance.

### Asset custody — `design/` is the master, `public/` is the derivative

```
design/in-use/       12 masters. Full resolution, committed, NOT shipped.
design/reference/    10 contact sheets. Provenance only.
public/assets/brand/ derived @1x + @2x. What the browser actually downloads.
```

Everything in `public/assets/brand/` is generated by
`python3 scripts/build-brand-assets.py` from `design/in-use/`. The script
**refuses to upscale** — if a master is smaller than the target, it fails rather
than shipping a soft image.

`design/` is tracked in git (it is the master, and a master that lives on one
laptop is a master the team does not have) but it is listed in `.dockerignore`,
because ~38MB of source art in the build context is 38MB of nothing. That line
is load-bearing: `checks/asset-custody.ts` asserts it, because the failure is
invisible — the image builds fine, just slower and fatter, forever.

**Never hand-edit anything under `public/assets/brand/`.** Edit the master, run
the script, commit both.

### The sparkle

One inline `<Sparkle />` on the active nav item. It is the system's single piece
of ornament and it is deliberate: the kit has personality, and a console that
adopts the palette and the mascot but keeps every surface perfectly inert reads
as a theme applied to someone else's product. One sparkle, one place.
`checks/sparkle-motif.ts` keeps it to one place — the discipline is not that it
exists, it is that it does not spread.

---

## 3. The layout contract

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

`scripts/layout-audit.ts` drives a real browser at three viewport sizes and
asserts ten structural invariants — the document never scrolls, nothing is
clipped, every scroller actually moves, the header stays put, every control has
an accessible name, no panel collapsed to a sliver, tables are reachable.

This exists because the characteristic failure of this system is **broken and
green**: TypeScript passes, tests pass, the page returns 200, and a screenshot
looks plausible because the visible rows are correct. Run it before shipping a
new page shape.

---

## 4. Component catalogue

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

### `EmptyState` and `showToast` take an optional illustration

Both grew ONE optional field in the brand adoption, and the shape of that change
is the point:

```ts
illustration?: { src: string; width: number; height: number }
```

`EmptyState`'s `icon` prop stays **required**. The illustration is additive: a
call site that passes none still renders the lucide icon exactly as before. All
**18** were then wired deliberately, one at a time, against the mapping in §2 —
so the icon is a fallback for a failed image rather than a style anyone still
renders on purpose.

For `showToast` the ratio is the argument: **1 of 37** call sites passes one.
`ApproveAction` sends `state-approved.png`; the other 36 hit the untouched
`CheckCircle2` / `XCircle` branch and were not read, let alone edited. Required
would have made that a 37-file change to express a one-file decision, and every
unconsidered site would have got whichever mascot was least trouble to type.

(37, not 39: `grep showToast\(` finds 39 occurrences, one of which is the
function's own definition and one a mention inside a comment. Counting matches
instead of call sites is the same mistake as counting check files instead of
declared checks.)

**The success toast on `ApproveAction` is a deliberate reversal.** That
component previously had an error toast only, and a comment explaining that the
receipt for a successful approval is the approvers row appearing — which is
sound reasoning. Approving is this platform's signature act, and it now gets the
mascot. Trade acknowledged rather than argued away.

**Not every empty surface gets a mascot, and the line is size.** A whole pane
standing empty gets one — that much dead space needs something in it, and the
illustration is what makes "filtered out" and "never written" distinguishable
before the words are read. A one-line placeholder does not: an empty row inside
a table whose headers are already visible (`runs`, the per-skill table) and the
line above a composer you are about to type into (`DocumentThread`) both say
what they need to in a sentence, and a mascot there is noise sitting between the
reader and the control. Both were checked and both were deliberately left.

**The Knowledge shelf was the eighteenth, and it was found by looking.** It
rendered its own inline empty block — correct, readable, and visibly not part of
this system. No check could have caught it: it never used `EmptyState`, so it
was never in the set anything counted. It now splits into the two states it
always distinguished, and each gets the mascot that belongs to it — `notfound`
when filters exclude everything, `empty` when the shelf genuinely is.

### `@/components/charts`

Hand-drawn SVG and CSS — **no charting library**, on purpose. A library ships
its own colour scale and type ramp, and the dashboard then carries two design
systems that drift apart. These read the palette through CSS variables, so a
rebrand recolours the charts too — which is exactly what happened in 2026-09:
the kit pastels landed in every chart without one chart file being edited.

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
`DashboardPage`, `Panel`, `Stat`, `PeriodSelect`, `Providers`.

`ThemeToggle` and `AppearancePanel` were **deleted** with dark mode — not
disabled, not left rendering a single option. Settings has no Appearance tab.

---

## 5. Conventions

**Formatters.** Every number goes through `@/lib/format`. They all accept
`null` and render `—`. Never coerce: "we measured zero" and "nobody measured"
are different facts, and a dashboard that conflates them is lying.

**Dates.** Every date goes through `@/lib/format-date`. Nothing calls
`toLocaleDateString` directly. `DISPLAY_TIMEZONE` is a cross-cutting invariant,
not a preference — bucket server-side on the same boundary or the chart and the
totals disagree by a day at the edges.

**Colour by token, not by hex.** Chart series take a `Tint` name from
`@/lib/tints`, the single place the cycle is declared. Eight tints exist —
`accent` `lavender` `pink` `blue` `sage` `amber` `rose` `steel` — but the
CATEGORICAL CYCLE is only the first four. `sage`/`amber`/`rose` remain available
to pass explicitly when the colour means something; `tintFor(i)` never returns
one. Every tint fill also carries `CHART_EDGE`.

**Panels, not bare Cards.** Reach for `Panel` unless the surface genuinely has
no title. `padded={false}` when a table or full-bleed list lives inside — it
also adds the horizontal scroll affordance, so a wide table can never be
silently cut off.

**URL as state.** The period lives in `?period=`, so a scoped view is linkable,
refreshable, and readable by a server component with no client round-trip.

---

## 6. Measuring craft

Two scripts, and they answer different questions. The layout audit asks *is it
broken?*; `audit:design` asks *is it disciplined?*; `verify:contrast` asks *is
it legible?* — and only the last one can fail your build.

```bash
pnpm verify:contrast     # 31 pairs, formula-checked, EXITS NON-ZERO
pnpm audit:design        # discipline counters, advisory
```

**`pnpm run gate` runs both of them.** That sentence is the whole point of this
section and it was false for the first six commits of this work.

A check nobody runs is not a check. This repository has now learned that four
times — `release.ts` carries a comment about the previous three — and the brand
adoption did it again, twice over: it shipped `verify-contrast.ts`, written
*precisely* because a silent contrast failure was possible, and wired it to a
`package.json` script a person had to remember. Then it shipped sixteen
`checks/*.ts` the same way. The release path runs typecheck, lint, test and
gate; none of those touched either one. **The initiative whose premise was "a
silent palette failure must become a loud one" left the palette failure silent.**

Both are now entries in `scripts/gate.ts`, which is already on the enforced
path — the fix belongs where the enforcement is, not in a second list to keep in
sync. Verified by breaking each: unreadable ink fails the gate, a deleted check
file fails the gate, a `dark:` variant fails the gate. They cost ~16s beside a
gate that already runs `next build`, so there was never a cost argument.

**`verify:contrast` exists because `audit:design` printed contrast failures and
returned 0.** A palette that failed on every surface would have shipped green
and silent. The new script enumerates each pair by name — `--ink` on
`--surface`, `--on-accent` on `--accent`, `--red-text` on `--red-tint`, and so
on — so a token that moves fails loudly, with the pair named and the measured
ratio printed.

It shares one formula with the browser audit rather than duplicating it:
`scripts/lib/contrast.ts` is the module, and `checks/contrast-formula-agrees.ts`
asserts the two copies agree to 1e-9. (They have to be two copies — the audit's
version is serialised into the browser by Puppeteer and cannot be imported.)

| Measure | Budget | Current |
|---|---:|---:|
| Distinct type sizes | 7 | **7** |
| Distinct weights | ≤4 | **3** |
| Distinct radii | ≤5 | **5** |
| Off-scale spacings | 0 | **0** |
| Enumerated contrast pairs passing | 31/31 | **31/31** |
| Hierarchy ratio, analytical pages | ≥3× | **3.6–4×** |

The dark-mode row is gone with the theme. What replaced it is stricter: a named
count of named pairs, rather than "however many failures the crawler happened to
walk past".

**One pair was removed from the set rather than fixed, and that is worth
knowing.** `--line-strong` on `--surface` measures 1.46:1. It was in the list
against a 3:1 floor and would have failed the build on a value that already
shipped. It is a decorative hairline, not a control and not a meaningful
graphic, so 1.4.11 does not reach it — a border you can barely see is the point
of a border you can barely see. The pair is out, with that reasoning written at
the exclusion. Deleting a check is only honest when you say why in the place
someone will look.

**Then look with your eyes.** No metric catches incoherence — two neutrals, two
label treatments, two radii that are each individually defensible. Only seeing
the thing at once does.

### Run them with `pnpm checks`, and mind the denominator

`pnpm checks` runs all seventeen and prints `17/17`. **Run it rather than looping
over `checks/*.ts` in a shell**, and the reason is a real failure rather than
tidiness.

The plan for this adoption declared **sixteen** task checks. Eleven files
existed — but only **ten** of them were among the sixteen; the eleventh
(`contrast-formula-agrees`) was an extra this work added and the plan never
asked for. So **six** declared checks had never been written. All eleven files
passed, and the work was reported as **"11/11 checks pass"** — a true numerator
against a denominator nobody had computed, and the report read as full coverage.

(The first version of this paragraph said *five*, by subtracting 11 from 16. It
is six. Getting the arithmetic of a miscount wrong while explaining the miscount
is a fair illustration of why the number is computed by a script now and not by
a person.)

A shell loop can only count what is on disk, so a check that was never written
is indistinguishable from one that does not exist.

So `scripts/run-checks.ts` declares the expected list **literally** rather than
deriving it from `readdir` — deriving it would reproduce the bug exactly — and
fails on a declared check that is missing OR an undeclared one that appears. It
also names the one check that was declared and never written
(`checks/visual/all-pages-render.ts`, task I-16) in its output, every run,
instead of letting it be quietly absent from a count.

### A check you have not tried to break is a check you are guessing about

Seventeen checks under `checks/` hold the parts of this system that a review
would not catch twice — including `doc-counts.ts`, which checks THIS PAGE.

Four rounds of review found stale numbers here: "eight sizes" for a seven-rung
scale, `.t-micro` given as 10px when it is 11, "5 EmptyState sites" where one
file carries two, "38 callers" for 37, and two contrast ratios transposed
between surfaces. None broke the product. All of them made this document less
trustworthy than the code, which for a design system is the entire asset. Every
one was a number a person typed and nobody could re-derive.

So the load-bearing counts are derived from the code and compared against the
prose. A claim that cannot be derived is not in that check — it measures
arithmetic, not judgement. **Six of them passed on a deliberately broken tree**, and the
only reason that is known is that each one was mutation-tested: break the exact
thing it claims to protect, confirm it fails, restore.

The escapes shared one shape — every one was satisfied by something already in
the file for an unrelated reason:

| The check | What it missed | Why it passed |
|---|---|---|
| `one-mark` | a second hand-drawn `<svg>` logo in the rail | the allowlist exempted the whole file for its one Sparkle |
| `one-mark` | `AppMark` no longer rendering the mark | `/wordmark/` matched the component's own docstring |
| `sparkle-motif` | `aria-hidden` stripped off the sparkle | an unrelated `<Icon aria-hidden />` sat within the proximity window |
| `chart-series` | the legend swatch losing its edge | `includes('CHART_EDGE')` matched the import line |
| `typography` | `@theme inline` repointed at the body face | nothing checked the mapping; the classes use the raw variable |
| `no-dark-mode` | `dark:bg-black` added anywhere | it looked for the machinery that was removed, never for the rule |

The last one is the instructive one and the most dangerous. A `dark:` variant
compiles happily against a project with no dark mode and emits a rule that can
never match — so the element silently keeps its light styling and the author
believes they shipped a dark treatment. The check guarding the entire breaking
change did not guard it.

**So: when you add a check here, break the thing first and watch it go red.** A
check written against a defect you just fixed is a regression test wearing an
invariant's name, and it will keep passing while the invariant rots around it.

### And two things only reading the screenshots could raise

Both were about a page nothing was counting:

- **The root 404 did not exist.** `app/(dash)/not-found.tsx` covers `notFound()`
  raised inside the shell. A URL matching no route at all never reaches that
  group, so it fell through to Next's built-in default: a **black** page in a
  product with no dark mode. `app/not-found.tsx` now exists, and
  `checks/mascot-assignment.ts` asserts it does.
- **The Knowledge reading pane** was a hand-rolled empty block — see §4.

> The upstream apps this was extracted from carry a `/components` gallery route
> for exactly this, and earlier drafts of this page told you to open it. **This
> console has no such route** — `/components` is a 404 here. Either port the
> gallery or delete the sentence; what must not stand is a design document
> sending its reader to a page that does not exist.

**So look at every page instead — but check you are looking at the real one.**

Two traps ate a whole validation run each, and both produce a screenshot that
looks plausible:

- **`output: 'standalone'` does not copy `public/` or `.next/static`.** The
  `Dockerfile` does it explicitly (lines 33-34); run the standalone server
  locally without repeating those two copies and every image 404s. The harness
  reported all 18 routes "ok" with not one mascot on screen.
- **A rebuild re-hashes every chunk, and the standalone copy keeps the old
  names.** Anything that runs `pnpm build` — `checks/icon-convention.ts` does,
  by design — leaves an already-running standalone server serving HTML that
  points at chunks it no longer has. The JS 500s, nothing hydrates, and every
  page sits on "Checking your sign-in…" forever.

Both are invisible to a harness that only guards against 5xx on the DOCUMENT.
Guard the sub-resources too, or re-copy and restart after every build.

**And the still frame is not the whole product.** The approve toast lives for
3000ms after a click that mutates state, so no page-load harness can ever
contain it. It was validated by driving the real page — click `Approve`, click
`Confirm`, wait for `[role="status"]`, screenshot — and by a test
(`tests/approve-action.test.tsx`) mutation-checked against five ways it could
break. Anything transient needs one of those two, and ideally both. The brand adoption was validated by rendering
all 18 routes against a production build, in both populated and empty states,
and reading the screenshots. Three things were caught that way and by no check:
a stale server quietly serving 500s while the harness reported success, bare-array
fixtures producing error boundaries that look like rendered pages, and the
Knowledge empty state above. A page that returns 200 is not a page that looks
right.

## 7. Provenance

**The brand.** The ZZ kit — wordmark, mascot, palette, the whole cast of states
— was commissioned by the product owner and delivered as source art in 2026-09.
It is not derived from a template and it is not stock. The masters are in
`design/`, the contact sheets that show what was delivered (including the pieces
that were NOT adopted) are in `design/reference/`. Adopting it whole, rather
than borrowing a hex value from it, was the owner's explicit call.

**The system.** Extracted from two production apps that share this system. The UI kit is taken
from the richer of the two; `shell.tsx`, `status-dashboard.tsx` and
`globals.css` are taken from the other, which carries later fixes (the flex-crush
guards, the rail-less-branch height bound) and no app-specific coupling.

Domain-specific components were left behind on purpose — stage rails, audit
findings, SDLC navigators. If you are diffing against an upstream app, that is
why those files are absent.
