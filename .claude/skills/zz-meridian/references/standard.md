# The Meridian standard, and the scoreboard that proves it

The person gives you one sentence. Everything they did not say is this file: the bar their product is held to, how you
judge it from every side, and how you keep improving it until it meets that bar. They should see a finished product and a
short, honest hand-over, never the machinery. The work is done when the scoreboard says so on evidence, not when the code
compiles or a first render looks fine.

## The register

A Meridian product is a product UI: a console people open every day to answer a question and act on it. It answers to
the Apple Design Awards' criteria (interaction, visuals, inclusivity, delight), to Webby's, and to the best products in
its category, side by side. In this register spectacle that slows a repeated task is a defect: a figure that animates
in on every visit, a hero banner above the data, a transition someone waits through.

When a request asks for a marketing or launch page beside the console, that page answers to Awwwards, FWA and CSSDA
instead (design, usability, creativity, content), built from the same tokens.

The register is the look a product answers to. It is `optional:docs/register.md` when present, otherwise `register.md`
(Meridian's own). It sets theme default, signature elements, anti-defaults, brand taste and look-dependent values in
Colour, Typography, Hierarchy and Originality. It never changes a floor, required states, Copy, Responsive or Navigation
quality, accessibility, the loop or the existing budget-governance policy. Read the register in force before you build,
and name it on the scoreboard's "Register:" line.

How a project register is applied:
- A line that would change a floor, or anything else the register never changes, is not followed. The floor holds. Record
  the line in `out/standard/questions.md` and name it, with the reason, in the hand-over.
- Meridian's `register.md` holds for any value the project register does not set (a hierarchy ratio, a size count, a face
  for a kicker).
- A project register that lists its own anti-defaults, or permits one Meridian refuses (pill buttons), replaces
  Meridian's list.
- A project register that names its own brand route (a command the project owns, and its rules) is followed instead of
  `npx zz-meridian brand` and the status-hue rule. That route is a local edit and is not recorded in the manifest.
- Its face, radii and colours reach the product through the project's token files (`tokens/*.tokens.json`, then
  `pnpm tokens`), never as literals. A managed token or style file the project changes for its register is listed in
  the keep register (`optional:.meridian/keep.json`, `update.md`, "Keeping a file on purpose").

## The scoreboard

Keep it as a file, `out/standard/scoreboard.md` (`out/` is git-ignored in every Meridian project, so it is never
committed), beside `out/standard/log.md` (each round: what ran, what you changed, the commit) and
`out/standard/questions.md` (the judgment calls, below). Write them as you go, and re-read them, with this file,
SKILL.md and `optional:docs/brief.md`, after any context compaction or at the start of a new session: they say where the
work stands.

It has one row per view, and a view is anything a person can reach: every rail route, each detail page in each state
worth seeing (a normal record, a failed one, a missing one), every dialog, drawer and sheet, sign-in, not-found, and
each MCP view under `optional:app/embed/`. A state of a view (empty, loading, error, long text) is scored under that
view's States row; a different address (a detail record, a missing one) or a dialog is a row of its own. The shell
(rail, command palette, appearance menu, phone drawer) is one row. Build the list from `app/`, `src/app.config.ts` and
the running product, not from memory. A narrow request ("add a refunds page") still scores every view: the product meets
the standard as a whole, and a defect you meet on another page is fixed too.

```md
# Scoreboard · <Product> · round <n>
Request: <what the person asked for, verbatim>
Route: <adopt | create | update | brand> · Register: product UI, <Meridian's own | docs/register.md> · Defaults noticed: <none, or each one and what replaced it>

## Floors
| Floor | Result | Evidence |
|---|---|---|

## /orders · Orders
Answers: <the question this page answers, from the brief>
| Criterion | Verdict | Evidence |
|---|---|---|
```

### The floors: measured, pass or fail

Each floor is measured by a command, and its evidence is the line the command printed. A floor that could not run is
`not run` with the reason, never a pass.

| Floor | Measured by |
|---|---|
| Gate: tokens fresh, specifications complete, no literal value, contrast in every theme and accent, lint, types, tests | `pnpm gate` (inside every `pnpm verify`) |
| The numbers the pages show are the data's | `example:tests/data.test.ts` asserting the counts and totals the pages show (SKILL.md, step 5) |
| Build, route policy, first-load and HTML sizes | `pnpm verify` |
| Every view at 2560, 1440, 1024, 768 and 390px in both themes: no sideways scroll, clipped text, table wider than its card, unnamed control, text under 4.5:1, control without a focus ring, touch target under 44px, runtime error; inside open shadow roots too, and a custom element it cannot look inside is `unmeasured:` (`validation.md`) | `pnpm verify --full` (the audit) |
| Every control pressed and every link followed, mouse at 1440px and taps at 390px, controls inside open shadow roots included; nothing does nothing | `pnpm verify --full` (the presses) |
| The whole keyboard path, a visible focus ring (a change on focus) at every stop, and the same stops in reverse with Shift+Tab | `pnpm verify --full` (the keyboard walk) |
| The assistant off and on, when the project has it; live data across tabs, restarts and offline, while the sample Members page it drives is there (a product's own live pages add a `browserChecks` script) | `pnpm verify --full`; a step it prints as `n/a`, with its reason, is not applicable and does not count against the outcome |
| LCP under 2.5 s, INP under 200 ms, CLS under 0.1 on a mid-range phone | `pnpm verify --full` (the vitals) |
| Reduced motion shows the final state at once | motion only through `src/styles/motion.css`, whose reduced-motion rule covers it; nothing animates outside it |
| All of the above together | `pnpm verify --full` ending with the line `the project meets the Meridian standard` |
| In an existing product, what it did still works: every route at its URL, every action sending the request it sent, its own tests and scripts (a project with no tests of its own has its `lint` and `build`) | the list from `existing-project.md` ("Before you change anything"), each item checked against the fake API's log and the project's own commands |

`--full` checks what the project tells it about, so keep `scripts/verify.config.ts` true to the product as you change it
(its comments describe every field, and the template's own entries show the shape): a `navigationChecks` entry for every
rail route (a ready selector and one harmless probe that works at 390px too, where a table is a card list with no
column headers to sort: a filter, a link or a dialog), `detailRoutes` with ids from your data for each state worth
seeing, `smokeRoutes` among the rail routes, `budgets.htmlKb` naming only routes that exist, a `fakeApi` as soon as a
page calls an API, and in an adopted project a `fakeApi` or `noLiveApi` (a created project whose pages read only its own
sample needs neither). After the pages change, look at the sizes `pnpm
verify` prints and record them with `node scripts/sizes.ts --write-baseline` once you have judged them. `--full`
refuses, listing every gap, until these hold.

### The craft: judged on the renders, with evidence

Look at every view rendered, not at the code. With `node_modules/.bin/next dev --port 3100` running (the port the screenshot and audit
scripts read; stop it again before `pnpm verify`, which builds in the same folder), run
`node scripts/shot.ts <routes> --width 1440,390 --theme dark,light --full`, plus 768 and 2560 where the layout depends on
width (tables, grids, side panels), and open every PNG in `out/shots/`. A dialog, sheet, menu or popover is shot open:
`--press "<the name of the control that opens it>"` (the first visible control with that name; give row actions names
of their own, "Delete order CR-10425"), repeated for a menu item inside it. With a fake API, every server a render or
a check reads from is started with its address (`API_URL=<fake> node_modules/.bin/next dev …`), never the `.env` one. `node scripts/audit.ts --routes <routes>` against
the same server ends with "Design metrics at 1440" for each route: the type sizes and weights in use, the radii, and the
hierarchy ratio (the largest text over the median).

Score each criterion **Strong** (it would stand beside the category's best; say what makes it so), **Good** (no defect,
and what is left is taste), or **Weak** (a defect a person would notice or hit; it gets fixed). A view's verdict is its
lowest criterion's, and a criterion that does not apply (Agents with the assistant off) is `n/a` with the reason. A
criterion not yet judged is not a pass: a view with one is unscored, and the round is not finished.
Evidence is specific: a measured value, a width and theme where you saw it, a file and line. "Looks clean" is not
evidence.

| Criterion | What Strong looks like here |
|---|---|
| Fit | The page answers its question from the brief with the person's own data shape, and does what the request asked of it. What they asked for is there; what they did not ask for is gone |
| Hierarchy | One protagonist the eye lands on first (a featured metric, the table, the form; `node scripts/check.ts` fails a second featured metric); on analytical pages a hierarchy ratio as the register sets it, while a detail page or a form is judged by its protagonist alone; everything else steps back |
| Typography | Sizes from the scale, with as many sizes per page and weights as the register sets; figures with their unit and fraction stepped down; nothing set smaller to make it fit |
| Whitespace | The 4px scale; cards in a row share a height; gaps even between cards and inside them; one left edge down the page |
| Colour | Every colour has a job, as the register sets them; nothing coloured for decoration |
| Motion and response | Every press answers at once (a state, a toast, a sheet); motion from the tokens, quick and interruptible; data arrives once, nothing loops but a live dot or a skeleton |
| Responsive | Designed at each width, not shrunk: at 390px the protagonist leads, tables become card lists, actions stay reachable, dialogs become sheets |
| Navigation | The next step is obvious: rows open their record, a link's arrow says where it goes, the rail shows where you are, a dead end offers the way back |
| Copy | `voice.md`: sentence case, verbs on buttons, a unit and a period on every number; realistic data in the person's domain, never lorem ipsum or "Item 1" |
| States | Empty (first run and filtered, each with its one action), loading (a skeleton shaped like the page, rarely seen because the page's data is read through `read()` into the prerendered shell; a request-time read costs at least 300 ms a navigation: `cache.md`), error (what failed, and Retry), long text and extreme values (a 60-character name, a zero, a figure in the billions) all designed, and each one seen: a filter that matches nothing, a missing id, sample rows with the long and extreme values so the audit sees them at every width, and the page's `loading.tsx` and `error.tsx` rendered: against the fake API made slow or failing, or, with none, by making the page's read wait or throw for one dev render and reverting it |
| Agents | Only when the assistant or MCP views are on: the view shares a context that answers "why?" on its own (`agents.md`), and an agent's write goes through a Proposal with the Agent mark |
| Originality | One idea the view is remembered by, named in the evidence. The register names its own; a product view earns Strong with one of its own that serves its question. It comes from how the asked-for content is shown, never from adding content nobody asked for |

Consistency has no row: the gate fails any value that is not a token, so it is a floor.

## The loop

Run rounds until the stop condition holds. Order matters here, because each step reads what the one before it wrote.

1. **List the views** into the scoreboard (above), and write the floors' rows as `not run`.
2. **Build or fix.** Change working code only for a problem you can name, as simply as it allows, from Meridian's tokens
   and components. When a defect is one a test can catch (a wrong total, a missing state, a formatter), write the failing
   test at the lowest layer first, then fix it. Update the page's `README.md` and any doc that describes what you changed.
3. **Measure what changed.** `pnpm verify` while you iterate. A round that touched only some views checks only those:
   build once (`pnpm build`), serve it (`node_modules/.bin/next start --port 3100`, stopped by its own id), and run `node scripts/audit.ts`,
   `node scripts/interactions.ts` and `node scripts/keyboard.ts`, each with `--routes <the views you changed>`; a change
   to the shell, a shared component, the tokens or the data touches every view. `pnpm verify --full` runs once more at
   the end, over everything, because only it can show the stop condition. Fix the cause of every failure, never the
   check (`validation.md`).
4. **Look and score.** Render, open every PNG, and score every view with its evidence, looks judged against the register in force.
5. **Commit** each verified change on its own, staging the paths you changed by name, with a message that says what a
   person will notice. Commit locally only; pushing, releasing and deploying are the person's call.
6. **Next round** on every Weak and every failed floor. An approach that has failed three times is the wrong approach:
   change it rather than repeat it.

**The stop condition**: a round, run after your last change, in which `pnpm verify --full` ends with `the project meets
the Meridian standard`, every view has been rendered and scored, nothing is Weak, and the round found nothing new: no
failure, no Weak and no default that the round before it had not already fixed. That round is the last one; it needs no
round after it to confirm it. Then hand over (SKILL.md, step 7). If a floor cannot run here (no Chrome, no network, a
missing credential only the person has), install or substitute what you can first; what is left is `not run` with its
reason, and the hand-over says plainly that the standard is not yet proven and what would prove it.

## Deciding without stopping

The person handed you the whole job. Settle everything you can find out: code, docs, history, running the product, its
tests and the web answer mechanical questions, and design calls are yours to make. Write each one you made on their
behalf in the brief's Decisions, one line with its reason.

A judgment call is one where, with all the evidence in, reasonable owners would still choose differently: product scope
beyond what they asked, a brand direction nothing in their materials points to, removing something their users can still
reach, a cost or security trade-off. Never stop for one. Write it in `out/standard/questions.md` with the options, your
recommendation and what waits on it; when it is local and cheap to reverse, proceed on your recommendation in its own
commit and list it in the hand-over; otherwise leave only what depends on it, and carry on with the rest.

Some actions reach past their machine, and those always wait for the person's yes: pushing, a release, a deploy, writing
to production data, and filing the feedback issue (SKILL.md, step 8), because each is public or permanent.