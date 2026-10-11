# Validation: what `pnpm verify` checks, and how to fix what it finds

`pnpm verify` has three modes. Each ends with one coverage line before its outcome, which says what ran and what did not:

```text
coverage: <default|full|perf|full+perf>; browser <ran|not run (<reason>)>; <n> routes; data configured <a>/<n>; interaction configured <b>/<n>; not run: <suites>[; failed: <suites>]
```

- **`pnpm verify`** is bounded: steps 1 and 2 below once each, the route policy, the first-load and HTML size checks, and
  a smoke of up to three routes (`smokeRoutes`, else the landing route and the next two rail routes) on desktop and
  through the phone drawer. It never refuses for a missing Chrome or safe backend: it runs the static checks and reports
  the browser as `not run (<reason>)`. A route without a mapping in `navigationChecks` counts as `not configured` for
  data and interaction, which is a warning, not a failure.
- **`pnpm verify --full`** adds the navigation of every rail route and steps 3 to 8. It needs a mapping for every rail
  route, Chrome, a safe backend and `optional:scripts/verify.baseline.json`, and fails with every missing piece listed before it
  builds anything.
- **`pnpm verify --perf`** runs the 20-sample navigation protocol. It does not imply that the `--full` checks ran;
  `--full --perf` unions the two and runs the gate and the build once.

A failing gate, build or start stops the run there, and so does a failing assistant-absent check (step 3); from the
audit on, every check runs and the report lists each failure. In `--full`, a suite that left a case unrun (no Chrome, no
second server for the live-data restart case) prints `not run`, never `ok`, and the run ends with `every check that ran
passed; not run: <suites>`; only a run with nothing left unrun ends with `the project meets the Meridian standard`.
Steps in order:

0. **Rail navigation** (`--full` only): every rail route is navigated, with its data and interaction mappings from
   `navigationChecks`.
1. **The gate** (`node scripts/gate.ts`): tokens regenerate to the same CSS; the card registry is fresh; every card and
   page specification follows the anatomy; the product's own rules in `optional:scripts/check.local.ts`, when the file exists;
   contrast holds for every pair in every theme and accent, and the chart palette passes the colour-vision checks;
   eslint-config-next; TypeScript; the tests.
2. **A production build** (`next build`), against the fake API when `scripts/verify.config.ts` names one.
   Then the route policy and the size checks: first-load JS per route, and the HTML caps in `budgets.htmlKb`. Navigation
   readiness (`scripts/navigate.ts`) times each rail route's shell, data and interaction from a press — on a desktop and
   through the phone drawer, against `budgets.navigation`. One entry in `navigationChecks` may carry its own `budget` for
   one of those figures on one device, which is how a route whose own page is heavy is held to what it measures instead
   of lowering the bar for every other route.
3. **The assistant walk-through**, only when the project has `optional:app/api/assistant/route.ts`: off, then on against a fake
   model. What every product shares runs on its own rail (no agent control while off, the panel, a reply, the page the
   model was told, markdown, the thread across navigation, Clear, the layout, a refused key, the key never reaching the
   browser); the steps that drive the template's sample Overview, Members, API keys and Settings run while those pages
   exist and print `n/a` with the reason once the product has replaced them. It finds the launcher, the panel's controls,
   rows and menus inside open shadow roots too, so a design system built from web components is walked the same way.
4. **The built app, served**, and the **browser audit** of every static route under `app/` and the `detailRoutes` in
   `scripts/verify.config.ts` (embeds under `/embed` on a simulated host ground) at 2560, 1440, 1024, 768 and 390px in
   both themes. It measures inside open shadow roots as well as the light DOM, so a web component's text, names, targets,
   contrast and focus rings count; a custom element it cannot look inside is `unmeasured:` (see "Lines that are not
   about the page" below).
5. **Every control pressed, every link followed** (`scripts/interactions.ts`) on the built app: mouse at 1440px, taps at
   390px. A button that changes nothing, a control something else covers, and a link that answers 4xx all fail. A control
   inside an open shadow root is pressed too, and named with its host: `Save (in x-card)`.
   **This presses Approve, Revoke and Delete too.** Pages that call a live API must be built against a fake one
   (`fakeApi` in `scripts/verify.config.ts`; see `existing-project.md`, step 5), or verify changes real data.
   The same hazard through another door: pages that read a database directly. verify reads `DATABASE_URL` — and any
   name in `dataUrls` — from the environment and from the `.env` files Next would load, and refuses to start when one
   resolves to a host that is not this machine. Point it at a local copy for the run, and restore the data afterwards:
   the walk-through flags rows and a press can delete.
6. **The whole keyboard path** (`scripts/keyboard.ts`), beside the audit and the presses: Tab through each page until
   focus comes back round, then Shift+Tab back through the stops. The first stop in the shell is "Skip to content", every
   stop shows a focus ring and is not hidden under something such as the sticky top bar, every visible control is reached,
   and the way back visits the stops in the reverse order. A focus ring is a change: the control's outline, shadow or
   border (or the frame around it, or any ancestor up to its host inside a shadow root) differs when it has focus. A ring
   that is always there does not count. With them run the
   product's own browser checks (`browserChecks` in `scripts/verify.config.ts`), each given `--base` and the served
   app's address.
7. **Live data** (`scripts/live.ts`), alone after the presses, which change members: two tabs, a quiet or restarted
   stream, a hidden or offline tab and a burst, against a second server that drops its change hints. A case that cannot
   run is `not run` and the suite exits 2. It drives the sample Members page; a product without it prints `n/a live
   data`, which does not count against the outcome, and proves its own live pages through `browserChecks`. It presses
   the sheet, the row menu and the Remove dialog inside open shadow roots too.
8. **Web Vitals on a mid-range phone** (`scripts/vitals.ts`): Lighthouse's mobile profile (CPU slowed four times, Slow 4G,
   390px touch). Every product page must hold LCP under 2.5 s, INP under 200 ms and CLS under 0.1; INP is the slowest
   tap on a control that changes the screen, found inside open shadow roots too, and each line ends with `taps: N`, the
   controls it tapped (`taps: 0` means the page's INP rests on no tap). It runs alone, after the others, since throttling measures the machine
   too: on a busy machine, run it again before believing a near miss.

The report is in `out/verify.txt`. Fix the cause; never weaken a check to make it pass. pnpm may first print a lockfile
and supply-chain check before a script runs; that is pnpm, not an install, and not a failure.

## Gate failures

| Message | Cause | Fix |
|---|---|---|
| `tokens.css is out of date` | A token file changed | `pnpm tokens` |
| `registry.ts is out of date` / `no preview.tsx` | A card folder was added, renamed or has no preview | Add `preview.tsx`; `node scripts/registry.ts` |
| `missing ## Structure` (page) or `## Surfaces` (card) | A specification is incomplete | Write the section; see a template page's `README.md` |
| `literal colour #...` | A hex or rgb in a component | Use a role (`bg-surface`, `text-ink-2`, `border-line`, `text-accent-ink`) or add a token |
| `font-bold is outside Meridian's scale` | A Tailwind default utility | Use `font-semibold`, `rounded-xl`, `shadow-card`… |
| `names \`x\`, which is not a token` | A spec names a token that does not exist | Correct the name or add the token |
| `FAIL light brand ... on-accent on accent` | The brand accent is too light for white text | Re-run `node scripts/brand.ts --hue … --chroma <lower>` |
| `warning: hue … from the critical status hue` (brand) | The brand colour reads as a status | Take the nearest hue 20° away, keep the brand colour in the logo mark, and record it (SKILL.md step 4) |

## Audit failures

| Message | Cause | Fix |
|---|---|---|
| `sideways: scroll region 1042 > 768` | Something wider than the window | A table with too many columns: `hideBelow` on low-value ones; a long id: `truncate` with a `title`; a fixed width: use `min-w-0` and fractions |
| `clipped: … "text"` | Text cut without an ellipsis | Give the element `truncate`, or let it wrap; never shrink the type |
| `unnamed: button…` | An icon-only control (a web component's button counts the text slotted into its host as its name) | `aria-label` on it (Icon button requires one) |
| `scrollers: …` | A card scrolls on its own | Page the list (`DataTable` pages at 20) or cap it ("top 5"); only the page scrolls |
| `contrast: 3.1:1 … "text"` | Text below 4.5:1 | Use `ink`, `ink-2` or `ink-3` on surfaces; status text uses `*-ink`, never the fill colour |
| `no focus ring: …` | A control with `outline-none` and no ring, or one whose outline, shadow or border is the same with and without focus | Remove `outline-none`, or add `focus-visible:outline-2 focus-visible:outline-accent`. A ring painted permanently is not a focus ring; a specimen that depicts the focus state is drawn inert (`State` with `still`) |
| `unmeasured: x-card (no open shadow root)` | A custom element shows a box but exposes no open root and no content in the page, so nothing inside it was measured | Attach its root open (`attachShadow({ mode: 'open' })`), or render its content as light DOM in a slot; the audit fails until it can look |
| `unmeasured: x-card (not defined)` | A custom element was still not registered after the settle wait | Register it (`customElements.define`) before the page settles, or remove the tag from the page |
| `"Export" does nothing when pressed` | A control with no action, or one that only works on hover | Wire it, or remove it; an info button uses `Tooltip toggle` so a tap opens it |
| `table … > its frame` | A table wider than its card, its last columns clipped | `hideBelow` one more column, or `truncate` the lead column. When the lead (`grow`) column holds a long name and another column is wide too, hiding columns may not help: move `grow` to the shorter text column |
| `exception:` / `console.error:` | A runtime error or a hydration mismatch | Hydration: no `Date.now()`, `Math.random()` or locale-dependent formatting in render; use the demo clock and `src/lib/format*` |

## Keyboard walk failures

| Message | Cause | Fix |
|---|---|---|
| `no focus ring: …` | Focus changed nothing the walk can see | As in the audit table above |
| `hidden under …: …` | A focused control sits under another element, such as the sticky top bar | Give the scroll container a `scroll-padding` for the bar, or lift the control above it |
| `never reached: Run` | A visible control no Tab press focuses | Make it focusable, or take a negative `tabindex` off it |
| `never reached: Run (Tab skips it; only Shift+Tab reaches it)` | Tab never lands on it, but Shift+Tab does: the order differs by direction, usually a `tabindex` above 0 | Take the positive `tabindex` off and let the order follow the document |
| `reverse order differs: Shift+Tab visits …, Tab visited … (reversed)` | The stops are not the same list in both directions | Look for a focus trap, a script that moves focus, or a positive `tabindex` |
| `could not be found again: …` | A control was listed and then left the page | It is rendering unstably; make it stay put or stop listing it |

## Lines that are not about the page

Two lines say something about what the suites could see, not about a defect in a page's own styles.

- **`unmeasured: <element> (no open shadow root|not defined)`** is the audit saying it did not measure that element, and
  it fails like any other finding so that a custom element is never passed unseen. The fix is in the element, as in the
  audit table above; the audit does not skip it and a check is never loosened to let it by. A closed shadow root cannot
  be entered by any script, so a component that must be checked ships with its root open.
- **`note: <selector> matches <n> elements; the first visible one was used`** comes from a `navigationChecks` entry
  (`readySelector`, `controlSelector` or `resultSelector`) that matches more than one element. It is printed once per
  selector and is information, never a failure: the first visible match was pressed, as before. If that is not the
  control you meant, write a more specific selector. A descendant combinator does not cross a shadow boundary, so name an
  element inside a root with a selector written for that root.

## After it passes

Look at the pages (SKILL.md step 6). The audit measures what can be measured; the eye checks what cannot: one
protagonist per page, balanced columns, even rhythm between cards, colour used only where it means something.
