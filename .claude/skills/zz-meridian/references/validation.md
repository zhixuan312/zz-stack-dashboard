# Validation: what the tests and diagnostics check, and how to fix what they find

The test commands are the only test entry points, and none takes an argument. The tool selects the tests:

| Command | Runs |
|---|---|
| `pnpm test:t1` | The static checks, then the Tier 1 tests affected by the changes since the last green run. |
| `pnpm test:t2` | The affected Tier 2 tests too, and the affected Tier 1 tests with them. |
| `pnpm test:release` | Every Tier 1 and Tier 2 test, once, plus lint, the type check, a production build and its size and route checks. |

Tier 2 is the file convention `*.perf.test.ts(x)` and the broad browser sweeps; every other test under `tests/` is
Tier 1. `tests/deep-*`, the browser-fixture tests of the checks, are Tier 1 and run as their own stage, kept out of the
main run by their size. `test:t1` never runs a Tier 2 check. A command writes `out/last-green` after a passing run and
reads it before the next; a missing marker falls back to the diff against master, and a checkout with neither runs the
whole tier. Follow `optional:docs/testing.md`, which says when each command runs and the rules a red, a limit and a
release follow, rather than deciding per change.

`test:t2` runs the browser sweeps (`scripts/browser.ts --depth fn`); `test:release` adds the timed ones on a quiet
machine (`--depth timed`). Each script also runs directly against a served build when a question needs it, with the
flags at the top of the script:

| Diagnostic | What it checks |
|---|---|
| `node scripts/audit.ts [--atlas]` | Every page and embed view at six widths in both themes, for layout, accessibility and contrast defects. |
| `node scripts/interactions.ts` | Every control pressed and every link followed, on desktop and phone. |
| `node scripts/keyboard.ts` | Tab through each page and back: focus rings, reach and order. |
| `node scripts/assistant.ts` | The assistant off, then on against a fake model. |
| `node scripts/live.ts` | Two tabs, a quiet or restarted stream, a hidden or offline tab and a burst. |
| `node scripts/navigate.ts` | Navigation readiness of each rail route, judged on function or on its budgets. |
| `node scripts/vitals.ts [--atlas]` | LCP, INP, CLS and dropped frames on a mid-range phone. |
| `node scripts/sizes.ts` | First-load JS and served HTML of a production build. |

A run that judges a time needs a quiet machine; nothing else does. Nothing that did not run is reported as passed: a
diagnostic says `not run` with the reason (no Chrome, no backend, no service) and never `ok`.

A failing static check stops a test command there. `test:release` stops on lint, the type check, or the first failing
test; a Tier 2 Postgres suite with no `MERIDIAN_POSTGRES_URL` is reported `not run`, never passed.

Steps in order:

0. **Rail navigation** (the navigation diagnostic, after the build): every rail route is
   navigated, with its data and interaction mappings from `navigationChecks`. A journey starts from the nearest rail
   route, in rail order, whose rail draws a link to the destination, so a rail that shows only part of the navigation on
   a page is followed. A workspace's home that no other route's rail links to (the only destination of its workspace) is
   reached through the workspace menu: from the nearest rail route before it, by the menu's item for its workspace, from
   that press, and its line says `through the workspace menu (<workspace>)`. Any other destination no rail links to is
   reported as a problem, never as a pass. A `navigationChecks` entry names a rail route, since the journey presses the
   rail's link to it. A rail route that redirects to a page under it (`/things` to `/things/<slug>` for the person
   signed in) is followed there: the press has arrived once the address is the route or under it, the entry's `title`
   is the page it lands on, and the line says `landed on <path>`. A page reached from a list is not a rail route: name
   it in `detailRoutes`, where the audit, the presses, the keyboard walk and the vitals open it. A page whose data arrived empty
   draws its first-run `EmptyState` (`data-empty="first-run"`) where the rows would be: once nothing in `main` is still
   loading, that is its data, ready, the line says `data is the first-run state`, and a
   control the empty page does not have is reported `interactive not measured: the page shows its first-run state`, a
   warning and never a pass. The error state (`data-empty="error"`) stays a failure.
1. **The static checks** (`pnpm test:t1` and `pnpm test:t2` run them first; `test:release` too): tokens regenerate to the same CSS; the card registry is fresh; every card and
   page specification follows the anatomy; the product's own rules in `optional:scripts/check.local.ts`, when the file exists
   (a rule there that asks whether a path is Meridian's reads `effectiveManifest()` from `scripts/lib/effective-manifest.ts`,
   which during an update answers with the files the update brings, where `optional:.meridian/manifest.json` is still the old release's);
   contrast holds for every pair in every theme and accent, and the chart palette passes the colour-vision checks;
   eslint-config-next; TypeScript; the tests.
2. **A production build** (`pnpm test:release` builds; a diagnostic reads a build you made). Then the route
   policy and the size checks: first-load JS per route, and every page's gzipped HTML, each against its own figure in `optional:scripts/verify.baseline.json` (and any absolute cap in `budgets.htmlKb`). Navigation readiness
   (`scripts/navigate.ts`) follows each rail route's shell, data and interaction from a press — on a desktop and through
   the phone drawer — and judges them on function only. Data and interaction are measured side by side, except that a
   `link` probe is pressed once the data is measured or has failed, since its press leaves the route;
   `--timing on` judges the same times against `budgets.navigation`.
   One entry in `navigationChecks` may carry its own `budget` for one of those figures on one device, which is how a
   route whose own page is heavy is held to what it measures instead of lowering the bar for every other route.
3. **The assistant walk-through** (`node scripts/assistant.ts`), only when the project has `optional:app/api/assistant/route.ts`: off, then on against a fake
   model. What every product shares runs on its own rail (no agent control while off, the panel, a reply, the page the
   model was told, markdown, the thread across navigation, Clear, the layout, a refused key, the key never reaching the
   browser); the steps that drive the template's sample Home, Now, Members, API keys and Settings, and those that ask its Usage and Tests through their prepared queries (`explore_usage`, `explore_tests`), run while those pages
   exist and print `n/a` with the reason once the product has replaced them. It follows only rail links that are on screen
   and opens an address when the rail on screen does not link to it. It finds the launcher, the panel's controls,
   rows and menus inside open shadow roots too, so a design system built from web components is walked the same way.
4. **The built app, served**, and the **browser audit** (`node scripts/audit.ts`) of every static route under `app/` and the `detailRoutes` and
   `missingRoutes` in `scripts/verify.config.ts` (embeds under `/embed` on a simulated host ground) at 2560, 1440, 1024, 768, 390 and 320px in
   both themes. It measures inside open shadow roots as well as the light DOM, so a web component's text, names, targets,
   contrast and focus rings count; a custom element it cannot look inside is `unmeasured:` (see "Lines that are not
   about the page" below). It reads an SVG's text too, by its `fill` against whatever the SVG paints behind it, and it
   asks three things about text beyond "does it fit": whether text cut with an ellipsis keeps the whole of itself in a
   `title`, whether two pieces of text are drawn in the same place, and whether a stroked line runs through one. Like
   the presses and the keyboard walk, it first waits for the shell's late chrome (the assistant's launcher) by the
   page's own signal, never by a duration, so a control that arrives late is measured and not passed over.
5. **Every control pressed, every link followed** (`scripts/interactions.ts`) on the built app: mouse at 1440px, taps at
   390px. A button that changes nothing, a control something else covers, and a link that answers 4xx all fail. A control
   inside an open shadow root is pressed too, and named with its host: `Save (in x-card)`.
   **This presses Approve, Revoke and Delete too.** Pages that call a live API must be built against a fake one
   (`fakeApi` in `scripts/verify.config.ts`; see `existing-project.md`, step 5), or the diagnostic changes real data.
   The same hazard through another door: pages that read a database directly. Point the diagnostic at a local copy,
   never at a production host, and restore the data afterwards:
   the walk-through flags rows and a press can delete.
6. **The whole keyboard path** (`scripts/keyboard.ts`), beside the audit and the presses: Tab through each page until
   focus comes back round, then Shift+Tab back through the stops. The first stop in the shell is "Skip to content", every
   stop shows a focus ring and is not hidden under something such as the sticky top bar, every visible control is reached,
   and the way back visits the stops in the reverse order. A focus ring is a change: the control's outline, shadow or
   border (or the frame around it, or any ancestor up to its host inside a shadow root) differs when it has focus. A ring
   that is always there does not count. With them run the
   product's own browser checks (`browserChecks` in `scripts/verify.config.ts`), each given `--base` and the served
   app's address; none of them judges a time.
7. **Live data** (`scripts/live.ts`), alone after the presses, which change members: two tabs, a quiet
   or restarted stream, a hidden or offline tab and a burst, against a second server that drops its change hints. A case
   that cannot run is `not run` and the suite exits 2. It drives the sample Members page; a product without it prints
   `n/a live data`, which does not count against the outcome, and proves its own live pages through `browserChecks`. It
   presses the sheet, the row menu and the Remove dialog inside open shadow roots too.
8. **The product's own timed checks** (`timedChecks` in `scripts/verify.config.ts`), each script given `--base` and the
   served app's address, one at a time and alone, after the live data. A check that judges a time belongs here and not
   in `browserChecks`, which runs beside other work; the half of it that judges no time stays in `browserChecks`.
9. **Web Vitals on a mid-range phone** (`scripts/vitals.ts`): Lighthouse's mobile profile (the device of
   Lighthouse benchmark index 800, the CPU slowed by the host's own index over 800, Slow 4G, 390px touch). Every page
   must hold LCP under 2.5 s, INP under 200 ms and CLS under 0.1, and drop no frame, the template's Design Atlas
   included (its front page and one card page; `node scripts/vitals.ts --atlas` measures every entry); INP is the
   slowest tap on a control that changes the screen, found inside open shadow roots too, and each line carries
   `taps: N`, the controls it tapped (`taps: 0` means the page's INP rests on no tap). A dropped frame is a gap over 50
   ms between animation frames, read in the tap's own window and no other, so one page's line is a count as well as a
   verdict: the floor is met when it reads `0 of N`. A page that drops one frame is measured a second time before it is
   failed — one frame in two hundred is inside the noise of a host the throttle is measuring too — and a page that drops
   one twice is a page that stutters. It runs alone, after the others, since throttling measures the machine too: on a
   busy machine, run it again before believing a near miss.

A diagnostic that passes leaving less than a fifth of its limit (a navigation time, LCP, INP, CLS, the longest frame)
prints a `warn` line: it passed, near its line. A slower machine fails such a pass, so before trusting it run the
suite again with `--rate 1.6`, which slows the phone 1.6 times beyond this host's own rate; a red there is a red to fix.

Each diagnostic prints its own report. Fix the cause; never weaken a check to make it pass. pnpm may first print a lockfile
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
| `truncated: … "text" is cut with an ellipsis and no title holds the whole of it` | Text is cut on purpose and the whole value is kept nowhere a pointer can reach | A `title` with the whole text on the element or what holds it (a `DataTable` column's `title`, a `TableCell` whose cell is a value sets its own, a `CardHeader` without `wrap` whose title is plain text sets its own); or let it wrap |
| `overlap: … and … are drawn in the same place` | Two pieces of text share a third of a line or more: a negative margin, an absolute label, a row that did not wrap | Give each its own place: a gap, a wrap, or a narrower label at that width |
| `overlap: a line (…) is drawn through … "text"` | A stroked shape (a sparkline, a rule, an axis) crosses the middle of a line of text | Move the caption out of the plot, or end the line before it; a filled shape under text is a ground and is read by the contrast check instead |
| `… "text" spills its box by 6px` | Text drawn past the edge of the box that holds it while nothing clips it: a fixed width, a label that may not wrap, a figure wider than its cell | Let it wrap, `truncate` it with a `title`, or give the box room (`min-w-0` on a flex child) |
| `heading skips a level: h2 then h4` | A heading level skips one, so a screen reader's outline of the page has a hole | Use the next level down, and make a heading look smaller with its type, never by choosing a deeper level; a card's specimen in the Atlas is exempt |
| `touch target under 44px: Close 24×24` | On a phone (a coarse pointer) a control answers less than 44px: its own box, its field's frame and its label together | Tag a small control `hit`, which answers a 44px square around it under a finger without growing, or put it in a field's `control-frame`; a link inside running text is exempt |
| `the page holds 0 characters of text — it rendered nothing, or only its loading state` | The page drew under 24 characters: it threw before it drew, or never left its `loading.tsx` | Open the route and read the console or the server log; a read that never answers holds the loading state |
| `the audit measured /sign-in while asking for /keys`, or `the address dropped period — …` | The route redirected, or rewrote its query, so what was measured is another page or view | Audit the address the page keeps (a redirect's target, the query it accepts), or fix the redirect that should not happen |
| `unnamed: button…` | An icon-only control (a web component's button counts the text slotted into its host as its name) | `aria-label` on it (Icon button requires one) |
| `scrollers: …` | A card scrolls on its own | Page the list (`DataTable` pages at 20) or cap it ("top 5"); only the page scrolls |
| `contrast: 3.1:1 … "text"` | Text below 4.5:1 (3:1 for large text). An SVG's `<text>` counts: its colour is its `fill`, its ground is what the SVG painted under it | Use `ink`, `ink-2` or `ink-3` on surfaces; status text uses `*-ink`, never the fill colour; in a chart, `fill-ink-2` or `fill-ink-3` for labels |
| `no focus ring: …` | A control with `outline-none` and no ring, or one whose outline, shadow or border is the same with and without focus | Remove `outline-none`, or add `focus-visible:outline-2 focus-visible:outline-accent`. A ring painted permanently is not a focus ring; a specimen that depicts the focus state is drawn inert (`State` with `still`) |
| `unmeasured: x-card (no open shadow root)` | A custom element shows a box but exposes no open root and no content in the page, so nothing inside it was measured | Attach its root open (`attachShadow({ mode: 'open' })`), or render its content as light DOM in a slot; the audit fails until it can look |
| `unmeasured: x-card (not defined)` | A custom element was still not registered after the settle wait | Register it (`customElements.define`) before the page settles, or remove the tag from the page |
| `"Export" does nothing when pressed` | A control with no action, or one that only works on hover | Wire it, or remove it; an info button uses `Tooltip toggle` so a tap opens it |
| `table … > its frame` | A table wider than its card, its last columns clipped | `hideBelow` one more column, or `truncate` a long column. Every column is as wide as its content, the spare sits in the gaps between columns, an equal share in each, and a cut column shrinks only when the table lacks room; a fixed `width` keeps its width, and the `grow` floor is 160px |
| `<route> answered 404, so what was measured is its error page and not the route`, or `<route> draws the not-found screen ([data-missing-page])` | The route answered an error status or drew the not-found screen, so the audit, the presses, the keyboard walk, the vitals and a shot read that screen in its place: a mistyped id in `detailRoutes`, a record the fake API does not hold, an address given by hand | Fix the id, or give the fake API the record. A record meant not to exist goes in `missingRoutes` |
| `<route> is in missingRoutes, and it answered 200 and draws no not-found screen` | A route declared missing renders a page, or the product's own not-found screen is not marked | The record came to exist: move it to `detailRoutes`, or name an id nothing holds. A not-found screen of your own carries `data-missing-page` on its root |
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

Three lines are not about a defect in a page's own styles: two say what the suites could see, and one what the data did.

- **`unmeasured: <element> (no open shadow root|not defined)`** is the audit saying it did not measure that element, and
  it fails like any other finding so that a custom element is never passed unseen. The fix is in the element, as in the
  audit table above; the audit does not skip it and a check is never loosened to let it by. A closed shadow root cannot
  be entered by any script, so a component that must be checked ships with its root open.
- **`note: <selector> matches <n> elements; the first visible one was used`** comes from a `navigationChecks` entry
  (`readySelector`, `controlSelector` or `resultSelector`) that matches more than one element. It is printed once per
  selector and is information, never a failure: the first visible match was pressed, as before. If that is not the
  control you meant, write a more specific selector. A descendant combinator does not cross a shadow boundary, so name an
  element inside a root with a selector written for that root.

- **`<route>: HTML grew <n>% over its baseline (cap 5%)`** with no change to the code means the page renders data that
  changed. Under a `fakeApi` the data is fixed and the figure measures code; a project whose pages read its own
  database (`noLiveApi`) measures whatever rows the database held at the build. Tell the two apart by building the
  commit the baseline was recorded on against the same data: when it grows by the same amount, the growth is the
  data's. Then re-record with `node scripts/sizes.ts --write-baseline --base <url>` and say in the commit that the data
  moved; the lasting fix is a fixed data set for the diagnostics (a seeded database), so the figure measures code again. Growth
  the old commit does not show is the code's, and is fixed in the page.

## Asking the agent's questions: `scripts/ask.ts`

The assistant diagnostic proves the assistant works with a stand-in model; it cannot say whether the real model answers a page's own
questions from its tools. Each page specification lists those questions under `### What the agent does here`, and
`node scripts/ask.ts` asks them of a served product, so a reader can judge each answer against what the tools returned.

```bash
pnpm build                                     # the assistant's ASSISTANT_* variables in .env.local, as the app reads them
node_modules/.bin/next start --port 3100       # served, and stopped by its own id when the questions are answered
node scripts/ask.ts --base http://127.0.0.1:3100 [--view usage] [--as viewer] [--out <folder>]
```

- **What it asks.** Every view whose specification lists questions, or the one `--view` names, by its view tool's name.
  Each question is asked once, in a thread of its own, on the page's address; a detail page's on its first record, the
  first link of its form on its listing page. Each carries the page as the console's panel sends it, as near as a
  script can: its title and its visible text as the persona is served the page. The view's shared context is published
  in the browser, so it is not sent.
- **Who asks.** A persona of `personas` in `scripts/verify.config.ts`: the one `--as` names, else `owner`, else the first
  declared. Its cookie signs every request in, so the assistant answers with exactly that person's rights.
- **What it writes.** `<folder>/<view>.md`, in `out/asks/` unless `--out` names another folder: each question, every
  tool the assistant called with its input and what the tool returned, every Proposal a write raised with its approval
  request or denial, and the answer's text. It prints one line for each file it writes, and exits 1 when a question
  went unanswered; a question answered by a Proposal alone is answered.
- **When it does not run.** It reads no environment and prints none of it: whether the assistant is on is the served
  product's to say. When `POST /api/assistant` answers 404 (no `ASSISTANT_*` variables), or the configuration declares
  no personas, it prints one line saying it did not run and why, and exits 0. An unknown `--view` or `--as` exits 1
  naming the ones that exist.
- **Not part of a test tier.** No test command runs it: a real model costs money and
  is not deterministic, so its answers are read by a person or a reviewing agent, never passed or failed by a script.

## After it passes

Look at the pages (SKILL.md step 6). The audit measures what can be measured; the eye checks what cannot: one
protagonist per page, balanced columns, even rhythm between cards, colour used only where it means something.
