---
name: zz-meridian
description: >
  Build a production-quality dashboard frontend on Meridian, a dashboard design system and Next.js template (dark-first,
  DTCG tokens, React components, charts, tables, MCP App views for AI hosts), then validate it against Meridian's
  standard. Use this whenever someone wants to build, scaffold, start, redesign or restyle a dashboard, admin console,
  analytics page, internal tool, ops or monitoring UI, back office, or an MCP App view, whether they give a one-line
  idea, a spec, a data schema, screenshots, or an existing frontend to improve. Use it even when they don't say
  "Meridian" or "design system": "I need an admin panel for our orders", "make our dashboard look professional",
  "turn this CSV into a dashboard", "add a console to this repo".
---

# Build a dashboard on ZZ Meridian

Meridian turns a description of a product into a running, branded dashboard that meets Meridian's standard. The person
you are helping should not need to learn Meridian, or say how good it has to be: they give you one sentence, and you do
the homework, build it, judge it from every side and keep improving it until it meets the standard, then hand over a
finished product and a short, honest account of it.

You work unattended from the sentence to the hand-over. `references/standard.md` is the bar and the way to reach it: the
register (the look it answers to: `optional:docs/register.md` when present, otherwise `references/register.md`, Meridian's
own; it never changes a floor, a required state, accessibility or the loop), the scoreboard of floors and craft you keep for every view, the loop you run until it holds, and which
decisions are yours and which wait for the person. Read it before you build, whatever the request: a new dashboard, a
redesign, one new page or a restyle all end at the same standard.

The template lives at `https://github.com/zhixuan312/zz-meridian`. Its own `README.md`, `CONTRIBUTING.md`
and `optional:docs/` are the full specification; this skill is the route through them. If you are reading this file inside a
clone of the template (for example `/tmp/meridian/skills/zz-meridian/SKILL.md`), that clone is the template: use it
wherever a step fetches the template, and read the references next to this file. Once a project has its own copy of
the skill (`optional:.agents/skills/zz-meridian/` or `optional:.claude/skills/zz-meridian/`, which `create`, `adopt` and `update`
keep at the project's Meridian version), follow that copy in it.

A path written `optional:<path>` may not exist in every project (a page the product deleted, a file only some projects
have); `example:<path>` names a file you write. Every other path the skill names exists.

## The rules that always hold

These hold in every project, however it started, and nothing below overrides them.

- **Build up, never sideways.** A page arranges patterns, a pattern composes components, a component is built from
  tokens. A value you need is a token, never a literal.
- **Never a literal colour, and never a Tailwind utility outside Meridian's scales.** `node scripts/check.ts` fails on
  both; the utilities render nothing (see "Things that render nothing" in `references/customize.md`).
- **Tokens are generated.** After a change in `tokens/`, run `pnpm tokens`. Never edit `src/styles/tokens.css` or
  `src/styles/theme.css`.
- **Agents read freely and write only through a Proposal.** Mark agent work with the Agent mark and "via"
  (`references/agents.md`).
- **Done is when the scoreboard says so.** `pnpm verify` is the loop while you work; the work is finished only when
  `pnpm verify --full` ends with `the project meets the Meridian standard` and every view is rendered, scored and none
  is Weak (`references/standard.md`). Never against a live backend: `--full` presses every control, Delete included, so
  a project whose pages call a live API or read a database names a `fakeApi` (or says `noLiveApi`) in
  `scripts/verify.config.ts` first (`references/existing-project.md`, step 5).
- **Commit locally, never publish.** Commit each verified change on its own with the paths named. Pushing, a release, a
  deploy, production data and the feedback issue wait for the person's yes.

## Choose the route before anything else

Whatever the words, the person wants one thing: a dashboard on Meridian. What you decide is **where its code lives**
and **which folder you may write to**, and that picks one of four commands. People rarely name the command, so read
the intent, not the verb: "change this product into our new dashboard", "redo this with Meridian", "make a new one
based on this folder in another folder" and "build me an orders console" are all requests for a dashboard; they
differ only in which folder ends up holding it.

| What is true | The route | The command |
|---|---|---|
| `optional:.meridian/manifest.json` exists in the folder they want changed | Already on Meridian: update, rebrand or keep building | `update` or `brand` (the next section), or straight to step 5 |
| They want **this** project changed in place ("restyle this", "change this product into our dashboard", "make our admin look professional"), and it is Next.js with the App Router | Adopt, here | `npx zz-meridian@latest adopt` (`references/existing-project.md`, Route A) |
| They want this project changed, and it is another stack (Vite, CRA, Remix, Vue, a static page) | A new project next to it, ported from it | `create <sibling folder>` (`references/existing-project.md`, Routes A2, B, C) |
| They want a **new** dashboard: in another folder, "based on" or "from" this folder, a schema, a CSV, a spec or nothing | Create, elsewhere; what they pointed at is input you read, never a folder you write | `npx zz-meridian@latest create <new folder>` |
| They ask whether it meets the standard, or what is wrong with it, and to change nothing yet | Evaluate: the loop's steps 1, 3 and 4 only (`references/standard.md`), and a hand-over that is the scoreboard and what keeps it from the standard | none; nothing is written outside `out/` |

Rules that settle the hard cases:

- **The folder they name to read from is not the folder you write to unless they said "this", "here" or "in place".**
  "Based on this folder", "use this as the source", "copy what this does" mean: read it, create next to it, leave it
  untouched.
- **`create` writes only into a folder that does not exist or is empty**, and **`adopt` changes the project it runs in**.
  Never run `adopt` in a folder they asked you to leave alone, and never `create` inside an existing project.
- **Two routes fit and nothing decides between them** (an existing Next.js app here and "build me a dashboard for
  this"): ask once, with in place (`adopt`) as the recommended option when they said "this" or "our", and a new folder
  (`create`) when they said "new" or "another". With no way to ask, take that recommendation and say so in the
  hand-over.
- **A run that stopped part-way is resumed, not restarted.** When `out/standard/` exists, an earlier run left its
  scoreboard, log and questions there: read them, treat its uncommitted work as yours to verify (build it, check it, keep
  what holds), and carry on from where the log stops. A folder on Meridian named only as a source ("based on this") is
  still read, never written: `create` next to it, and port its data seam, fake API and tests along with its pages.
- **Say the route in one sentence before the first command**: "This is a Next.js App Router project you want changed
  in place, so I am running `adopt` here." A wrong route is cheap to stop before the command and costly after it.

## Updating or rebranding a project that already has Meridian

When `optional:.meridian/manifest.json` exists and the person asks to update Meridian, or to change the brand, do not
follow steps 1 to 8: the project is already built.

- **Update.** Read `references/update.md` and follow it: `npx zz-meridian@latest update --dry-run` first, then the real
  update, the resolutions it asks for, and the pinned `--finalize` command it prints (with `--resume` and `--abort` for
  an interruption or a change of mind). Read `references/ownership.md` for which files are Meridian's and which are the
  team's; an update changes only the first, and a team keeps one of its own on purpose through `optional:.meridian/keep.json`.
  An update across a release that changed an interface reports a migration for each; `references/update.md` says how
  to resolve every one, and `references/cache.md` and `references/live.md` hold the starters and the shapes they move to.
  When the project is already on the running version, `update` prints `already at <version>; nothing to update`:
  say so in a one-line hand-over and stop. After an update that changed files, it is finished when the project meets
  the standard again (`references/standard.md`): run the loop on what it changed.
- **Rebrand.** `npx zz-meridian@<the manifest's version> brand [brand flags]`, from a clean git tree. Never hand-edit the
  brand outputs; an edited one makes it refuse. Step 4's check applies to the new colour. The exact brand colour lives
  in the product's own logo (an SVG in `public/`, named by `logo` in `src/app.config.ts`), never in a token. The rebrand
  is finished when the project meets the standard again, scored above all on Colour.
- **The hand-over** for an update or a rebrand follows step 7, with what changed in place of "Pages".

## 1. Do the homework first

Before deciding anything, look at what you already have:

- **The working directory.** Is there a frontend? Read `package.json` (framework, React version, Tailwind), the routes,
  and how data is fetched. Note what exists, so the route and the pages build on it.
- **What the person gave you.** A spec, a schema, a CSV, an API description, screenshots, a brand guide. Extract the
  entities, the metrics that matter, the lists people browse, the actions they take, and any brand colour.
- **What you can infer.** A product that tracks orders needs an orders list and an order page; a monitoring tool needs
  health; anything with money needs period selection and deltas. Draft the page list yourself.

## 2. Decide from your drafts, and say what you decided

The sentence is the whole brief you will get, so turn the homework into decisions rather than questions:

1. **What it is and for whom.** The product name (from their app, repository or materials, else a plain name for what
   it does), who uses it, and the one question the home page must answer.
2. **Pages.** Your drafted list, each mapped to the closest Meridian preset (Overview, list, detail, analytics, health,
   settings, sign-in), each with the question it answers.
3. **Brand and surfaces.** Under Meridian's register: the brand colour from their existing styles or logo, else indigo
   (what `create` and `adopt` give with no brand flag); dark first; MCP views only when they asked for the agent surface.
   A project register that names its own brand route or theme default is followed instead (`references/standard.md`, "The register").
4. **Place and units.** The timezone and currency from their materials, addresses or language, else this machine's
   zone and its currency: "today", "late" and every money figure depend on them. A currency is evidence of a place
   (a pound sign, a UK zone), stronger than the machine the run happens on. The person the rail shows signed in
   (`--user`, `--role`) is theirs when the product has one, else the team's name and a role; never the sample's.
5. **What their words mean.** A term the request uses but does not define ("late", "best seller", "active") gets a
   definition you choose, written in the Glossary and as a question with your recommendation.

Write them into the brief (step 3), each decision in its Decisions section with its reason, and list them in the
hand-over, where the person can change any of them in one line. Before the first command that writes anything, tell them in two
or three sentences what you are building, by which route, and that you will come back with it finished.

The one question worth asking is the route, when "Choose the route" leaves two open and you have a way to ask: ask it
once, with your recommendation first. Anything else you are unsure of is a decision you make and record
(`references/standard.md`, "Deciding without stopping").

## 3. Get the template, branded

For an existing frontend, follow `references/existing-project.md` instead: "Before you change anything" first, then
`npx zz-meridian@latest adopt`.

For a new project (a folder that does not exist yet, or an empty one: `create .` works in an empty working directory),
with the step-2 decisions as flags:

```sh
npx zz-meridian@latest create <target> --name "<Product>" --workspace "<Workspace>" --timezone "<IANA zone>" \
  [--currency <ISO 4217>] [--user "<Name>" --role "<Role>"] \
  [--accent indigo|cobalt|jade|graphite | --hex '#RRGGBB' | --hue <0-360> --chroma <0.10-0.18>]
cd <target>
```

It copies the template, brands it, installs the dependencies, initialises git, installs this skill into the project
(`optional:.agents/skills/`, `optional:.claude/skills/`) and records every file in `optional:.meridian/manifest.json`. The person gets their
dashboard, not a copy of the design system: the Design Atlas, the card and page specifications, `optional:docs/`, `decisions/`
and the changelog are left out, and the README and AGENTS.md are written for their product. To look a component up
while building, read it in the template on GitHub (`src/components/<layer>/<card>/README.md`).

Every product name, sample address and MCP tool name follows `--name`, so nothing of the template's own name is left
behind. A brand colour goes in as `--hex`: the OKLCH hue and chroma are derived (chroma capped at 0.18; the theme sets
lightness so contrast holds), registered everywhere, and checked by the contrast gate in every theme. Its output names
the hue; when it warns that the hue is near a status hue, step 4 says what to run next. To
change the brand later, run `npx zz-meridian@<the manifest's version> brand` with the new flags; never `node scripts/brand.ts`, which the manifest does not record.

Requirements: Node 22.18 or newer. A new project uses pnpm when it is installed, npm otherwise; an existing one keeps the
package manager its lockfile names, and one with no lockfile gets npm, as `adopt` chooses. The commands here say `pnpm`: in an npm project `pnpm verify` is `npm run verify`, and a flag goes after `--`
(`npm run verify -- --full`). The browser checks use Google Chrome
(`CHROME=/path/to/chrome` if it is not where the platform keeps it; a Chromium build works too). When one is missing,
install it or point at what is there; in a sandbox without network or a browser, ask for the access these steps need
(the package install, starting Chrome and a local server for verify). What still cannot run here does not stop the
build: the floors it measures are `not run` with the reason, and the hand-over says the standard is not yet proven and
what would prove it.

Now fill the brief, so the decisions survive the conversation.

`adopt` and `create` have already written `optional:docs/brief.md` as a template with five sections: Product, Users,
Data, Decisions and Glossary, each holding one guidance line. If the file is missing (an older project), write it
from this template:

```md
# Product name

## Product
What this dashboard is for, in two or three sentences: who opens it, what decision it helps them make.

## Users
Who uses it and how often; what they know already; what they must never be shown.

## Data
Where the numbers come from (systems, tables, APIs), how fresh they are, and what now means for this product.

## Decisions
Brand, layout and behaviour choices already made, one line each with its reason, so no session re-decides them.

## Glossary
The team's own words for things, one per line: term and what it means here.
```

Replace each guidance line with what the request, their materials and step 2 settled, in English. Never invent a product
fact: a section nothing settled keeps its guidance line, and `node scripts/check.ts` warns about it until it is written (a warning, never a failure).
No secrets go into the brief (no keys, tokens, passwords or connection strings): the assistant and every later session
read it. The template's assistant reads Product, Users and Glossary, so those three say what a stranger needs to
answer a question about this product.

## 4. Check the brand colour

This step applies under Meridian's register; a project register that names its own brand route is followed instead (`references/standard.md`, "The register").

Status colours own three hues: critical near 22°, warning near 68°, positive near 158°. A brand hue within 20° of one
(a red, amber or green brand) makes every button and selection read as an alert or as "healthy", and the script prints
a warning when it happens. Run `brand` again with `--hue <the nearest hue 20° or more away> --chroma <the same
chroma>` (or `--accent graphite` when no nearby hue suits the brand), and record it in the brief's Decisions and the
hand-over: it is one `brand` command to reverse. The exact colour stays in their logo when they have one; Meridian does
not draw a logo for them. If the person later keeps the original, keep the accent off figures and statuses: no
`emphasis` on Metric tiles, and accent only on actions and selection.

## 5. Build the product

Read `references/customize.md` and follow it. In short:

- **Reads, writes and live data go through the access seam** in a created project (an adopted one keeps its own data
  layer). Pages read with `read()` and writes invalidate their tenant
  (`references/cache.md`); the console keeps its tables fresh over one stream per tab (`references/live.md`, which also
  says plainly why the sample is a single process and holds the Postgres and Redis adapters).
- **Data first.** Write `src/data/<product>.ts` for the person's domain: real types from their schema or materials, and
  deterministic sample data until they wire their API. Pages import data from `optional:src/data/` and nowhere else. Delete the
  sample pages you replace. `optional:src/data/collections.ts` and `optional:src/data/sample.ts` import `optional:src/system/fixtures/` (and the dashboard layout imports
  `DEMO_NOW` and `ALERTS` through `optional:src/data/sample.ts`), so the fixtures and `optional:src/system/sample-cells.tsx` stay until nothing imports them:
  replace each collection's `rows` with the person's data first, then delete them. Prove the
  numbers before building pages: a `example:tests/data.test.ts` asserting the counts your pages need (vitest resolves `@/`;
  plain `node` does not).
- **Navigation** in `src/app.config.ts`; one line per page.
- **Pages from presets.** Start each page from the closest template page and change what it shows, not how it is laid
  out. Every page has one protagonist (a featured metric, a table, a form), a kicker, a title and one sentence.
- **Remove what they did not ask for**: sample pages, their nav lines, their embed views, their entries in
  `example:src/system/content.ts` (if the Atlas stays), and the links that point at them. Settings is a sample page too:
  delete it unless asked (theme, accent and density stay in the rail's appearance menu and the command palette), but the
  assistant's on/off switch ("Show the assistant") lives in Settings: keep the page, or tell the person the switch goes
  with it.
  `references/customize.md` has the checklist and the grep that finds what is left.
- **The assistant** is built in and off until `ASSISTANT_PROVIDER`, `ASSISTANT_API_KEY` and `ASSISTANT_MODEL` are set
  (`ASSISTANT_BASE_URL` is required for `openai-compatible`). Point `optional:src/data/collections.ts` at the person's data, and
  put their sign-in check in `optional:app/(dashboard)/layout.tsx`, in `optional:app/api/assistant/route.ts` and in every server action; see `references/customize.md`.
- **MCP App views** under `optional:app/embed/` only if they asked for the agent surface; see `references/agents.md`.

Build up, never sideways: use Meridian's components and tokens. A new colour, size or shadow is a token, never a literal;
a missing component is specified as a card per `CONTRIBUTING.md`. Interface copy follows `references/voice.md`: sentence case,
verbs on buttons, units and periods on every number.

## 6. Score it, and improve it until it meets the standard

Run the loop in `references/standard.md`, scoring looks against the register in force (`optional:docs/register.md` when present, otherwise `references/register.md`), until its stop condition holds: list every view into the scoreboard, measure
the floors, render and score the craft, fix every Weak and every failure, commit, and go round again. The commands:

```sh
pnpm verify            # the gate once, one build, the size checks and a smoke of up to three routes: the inner loop
pnpm verify --full     # every view at five widths in both themes, every control pressed, the keyboard walk, live data, vitals
node_modules/.bin/next dev --port 3100 & # then, for the renders (stop it with kill $!; with a fake API, set its address first: API_URL=<fake> node_modules/.bin/next dev …):
node scripts/shot.ts / <every other view> --width 1440,390 --theme dark,light --full
```

Stop the dev server before verify, which builds and serves the app from the same folder: stop the process you started,
by its id, never by a name or a pattern, since other servers on the machine may be someone else's. Start Next itself,
not through `pnpm dev`, whose id is the package manager's and leaves the server running when it is stopped. The default takes about two
minutes; `--full` takes about a quarter of an hour for a dozen routes. Every run ends with a coverage line, which says
the depth that ran, whether the browser ran (and why not), how many routes have a readiness and a control mapping
(`navigationChecks` in `scripts/verify.config.ts`), and which suites did not run:

```text
coverage: full; browser ran; 9 routes; data configured 9/9; interaction configured 9/9; not run: none
```

Nothing that did not run is reported as passed, and only a `--full` run with nothing left unrun ends with `the project
meets the Meridian standard`. `--full` refuses, listing every gap, until `scripts/verify.config.ts` describes the product
you built (`references/standard.md`, "The floors"). When something fails, read `references/validation.md`, fix the
cause, never the check, and run it again. A passing run is half the evidence: the other half is the renders, judged and
scored, because the audit measures what can be measured and the eye judges the rest.

## 7. Hand over

The hand-over is what the person reads, and what an agent checking the work reads too, so it quotes evidence rather than
describing it. Draft step 8's feedback first, since the hand-over carries it. Write it in the person's language, in this shape:

```
Built <Product> on Meridian at <path>. <One sentence on what it lets them do.>
Open it: <the commands, the fake API's included when there is one, and the address>.
Standard: <"met", or "not yet proven: needs <what only the person can provide>">. verify --full: <its last line, verbatim>.
Coverage: <the coverage line, verbatim>. Scoreboard: <n> views, <s> Strong, <g> Good, 0 Weak, after <r> rounds (out/standard/scoreboard.md).
Pages: <one line each: the page and the question it answers>.
Decided for you: <each decision from the brief's Decisions, one line each, with how to change it>.
Not run: <each floor that could not run here, why, and what would run it; or "nothing">.
Waiting for you: <each judgment question from out/standard/questions.md with your recommendation; or "nothing">.
Kept and removed: <for an existing product: what still works as before, and each file deleted because nothing used it>.
Commits: <the range, and one line per commit>.
Next: <wiring their API in src/data/, and anything that waits on them>.
Feedback: <the draft from step 8 and the question whether to open it, or "nothing about Meridian to report">.
```

Show the renders of the main pages at 1440 and 390px in both themes, and for an existing product each page's "before"
beside its "after" (`references/existing-project.md`). Say plainly what is sample data and what is not.
A created or adopted project has no Design Atlas. In a clone of the template it is there: it is Meridian's documentation,
not a view to score; say that `/system` is the live specification and that `node scripts/brand.ts --no-atlas` removes it
before the product goes public.

## 8. Offer feedback to Meridian

Meridian collects nothing from the people who use it: no telemetry, no analytics, no account. A GitHub issue the person
chooses to open is the only way anything reaches Meridian, so this step is an offer, never a requirement, and it
happens only when the run found something about Meridian itself.

Collect, from the whole session (not only the last step), and sort each finding into one of two kinds:

- **Bug**: a component, pattern, script, check or doc that did the wrong thing: a gate that failed on correct code, a
  check that passed broken code, a component that clipped, overflowed or did nothing, a doc that sent you the wrong way.
- **Feature request**: anything that worked but cost a workaround, a second try or a guess, and the change that would
  have saved it; and what the product needed that Meridian has no answer for (a component, pattern, state, page kind,
  surface rule, or a question this skill and the docs never answered).

Each finding gets what someone needs to act on it without asking: what happened, where in Meridian (its `file:line`,
the Meridian command, the Meridian route), how to see it again in Meridian's own template or sample data, and what you
did instead.

**Nothing in it may identify the person, their organisation or their product.** Before showing a draft, remove:

- the product's, company's, team's and people's names, email addresses and accounts;
- their URLs, hostnames, IP addresses, API routes and environment variable values;
- their data, records, schemas, field names and screenshots of their pages;
- file paths outside Meridian's own files, and anything from `optional:docs/brief.md`.

Describe the shape of the problem with Meridian's sample instead ("a Data table with 40 columns", not their table). If
a finding cannot be told without one of these, leave it out.

Draft one issue per kind, in the shape of Meridian's two issue forms, Bug and Feature request:

```
Title: <one line on the most important finding>

Meridian <version from .meridian/manifest.json> · Next <version> · Route <adopt | create>

## What happened
- <finding: what, where in Meridian, how to see it again, what you did instead>

## What would fix it
- <the change you would make to Meridian>
```

Put the draft in `out/standard/feedback.md` and in the hand-over, and ask whether to open it: it is published under
their account, in public. Only on a yes, file it with `gh issue create --repo zhixuan312/zz-meridian --label bug|enhancement --title "<title>" --body-file
<draft>`, or, without `gh`, give them `https://github.com/zhixuan312/zz-meridian/issues/new/choose` and the draft to
paste. Put the issue's URL in the hand-over. When the run found nothing about Meridian, or they decline, say so in one
line and file nothing.
