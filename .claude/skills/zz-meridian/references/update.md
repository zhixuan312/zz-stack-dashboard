# Updating a project built on Meridian

Run `npx zz-meridian@latest update --dry-run` first: it shows what moving this project to the running version of
Meridian would change, and which of those changes need the team's decision. It writes nothing in the project (it fetches
the recorded release from the registry, and works in a temporary folder). A plain
`npx zz-meridian@latest update` then applies the safe changes and stages the rest. Do not copy files by hand to make up
for either.

When the project is already on the running version, `update` (and its dry run) prints
`already at <version>; nothing to update` and exits 0: say so in the hand-over and stop there; the standard is not
re-proven for a change that did not happen. After an update that changed files, run the loop in `standard.md` on what it
changed, and close with `pnpm verify --full --timed`. A release can make a suite look further than the last one did (the
browser checks now look inside open shadow roots), so a finding that is new after an update may be a page that was never
measured before; `validation.md` says what each line means.

An update is tested from the last three releases. When the manifest's version is older than that (`npm view
zz-meridian versions` lists them), update in steps: first with the release three after it,
`npx zz-meridian@<that version> update`, through finalize, then again with `latest`.

## What it does

It works from `optional:.meridian/manifest.json`, which records the release the project was copied from and a hash of
every file Meridian put in. It rebuilds that release and the running one in a scratch folder (with the project's recorded
brand and shape, so no file differs for a reason of the replay), compares every managed file in three places (what was
recorded, what the running release has, what is on disk now), and acts on the result:

- **Applied**: untouched replacements, additions and untouched removals. Generated files come from the replayed target,
  so no generator runs in the project.
- **Staged**: every file the team changed, deleted or collided with, as exact copies for a three-way merge.
- **Never touched**: files in the keep register, and team-owned files. The only team files an update edits are
  `package.json` (missing dependencies and scripts, older ones of the same major, and entries still exactly as the earlier release wrote them; a version or script the team chose stays theirs and becomes a migration), the managed block in `AGENTS.md`, and the lockfile
  that the install rewrites. Everything else in `MERGE.md` is advice.

A real update refuses, writing nothing, when the git tree is dirty (unless `--allow-dirty`), when another session or lock
exists, when the manifest is missing or malformed, when the project is older than 0.3.0 or newer than the running version, when a keep entry is invalid, when a path is unsafe, or when the recorded files do not match a rebuild of their
own release (the message lists them). A dry-run prints a note instead of refusing for a dirty tree.

## The session

Every real update creates `optional:.meridian/update/<version>/`, even when nothing is staged:

| Path | Holds |
|------|-------|
| `state.json` | the journal: both manifests, every operation with its hashes, the phase, the migrations, retirements and validation results |
| `resolutions.json` | the team's resolutions; starts as `[]` |
| `MERGE.md` | the report to read |
| `base/<path>`, `ours/<path>`, `new/<path>` | the three sides of each staged file; a side that does not exist has no file, and `MERGE.md` says `absent` |
| `backup/<path>` | the preimage of every path the update changed, and only those |
| `evidence/` | the output of the install and, when finalizing, the gate and the build |

`optional:.meridian/update.lock` exists while a run is in progress. A lock that is left behind refuses every new update
and names itself and the session phase; an update never deletes it for you.

## Reading the output

Only the paths that need a decision are listed, one per line: the kind of change, the path, then what to do.

```
collision        src/components/ui/card/index.tsx  merge required
local-deletion   scripts/audit.ts  decide: delete or restore
migration  dependency:zod  pending
summary: 2 conflicts · aggregated: untouched 310, added 4, removed 1, team-preserved 12, kept 1
time: plan 3.1s · apply 0.2s · install 8.4s
outcome: migration-required
Next: resolve the items in .meridian/update/0.5.0/MERGE.md, then npx zz-meridian@0.5.0 update --finalize (or npx zz-meridian@0.5.0 update --abort)
```

- **`merge required`**: the team changed a managed file and Meridian changed it too (or the team has a file where
  Meridian now wants one). Combine `ours/` and `new/` with `base/` as the common ancestor.
- **`decide: delete or restore`**: the team deleted a managed file that the running release still ships. Either the
  deletion is deliberate, and the file stays out, or it is not, and the file should come back. When the project cannot
  tell you (the commit that deleted it, whether anything still imports it), keep their deletion, write it in
  `out/standard/questions.md` with your recommendation (`standard.md`), and carry on.
- **`migration`**: a change beyond copying files that the team must make (a dependency, a script, a release's own
  migration). `MERGE.md` holds the instructions and the checks.
- **`kept` and `retired-kept`**: a kept file that is missing, or one the new release removed and the update left in place.
- **`summary`**: the conflicts, then the counts of the files that need nothing. `kept` counts files left as the team has them.
- **`outcome`**: `dry-run`, `migration-required` (items to resolve), `install-pending` (the install was skipped with
  `--no-install`), `ready-to-finalize`, `complete` (finalize passed), `needs-resolution` (resolve what `MERGE.md` lists, then finalize
  again), `aborted` (the update was undone) or `failed`.
- **`--verbose`** lists every operation with its kind and action, not only the conflicts.

Exit codes: `0` for a dry-run (or an update that finalized itself because nothing was pending), `2` when the update is
applied with work pending, `1` for a refusal, a failure or an interruption.

## Resolving: `MERGE.md` and `resolutions.json`

`MERGE.md` lists every staged item as `file:<path>` and every migration as `migration:<id>`, with the paths of its copies
and a resolution stub:

```json
{ "id": "file:src/components/ui/card/index.tsx", "status": "resolved", "reason": "", "files": { "src/components/ui/card/index.tsx": "sha256-..." } }
```

Make the decision in the project's own file, then add one such object per item to the array in `resolutions.json`, with
a reason in a sentence and the file's hash as it is after your decision (`sha256-` plus the SHA-256 of the file, or `null`
when it is absent). A migration may be `not-applicable`, with a reason. A file edited after its resolution needs a new
hash. Exactly one resolution per item; unknown or duplicate ones fail the gate.

Proposed team changes in `MERGE.md` are advice. Make them yourself, in the project, and verify them.

## The pinned commands

`MERGE.md` and the `Next:` line name the release that started the session, for example
`npx zz-meridian@0.5.0 update --finalize`. Run exactly that command: `--resume`, `--finalize` and `--abort` belong to
the version and package that created the session, and refuse anything else (the message names the right command).
They read the session's own copies and never ask the registry.

### `--resume`: continue an interrupted update

Use it after a killed run, a failed apply, or an update started with `--no-install`. It checks the session's plan, then
looks at every operation that was not recorded as applied. A path that is still its recorded original is applied from
`new/` (or deleted); one that already is the planned result is recorded as applied; anything else was edited since,
so resume stops, names it and writes nothing for it. A later edit is never overwritten. It then runs the install if
that is missing or failed (skip it with `--no-install`) and ends as a plain update does: exit `2` with the items to
resolve, or finalize at once when nothing is left. It is also the only command that takes over a `optional:.meridian/update.lock`
left by a process that is no longer running, after it has read the journal.

### `--finalize`: validate and complete

1. It refuses an interrupted session (use `--resume`) and a session whose install did not run or failed.
2. Every item must be resolved and every resolution current (exit `2` otherwise, naming each open item).
3. The installed dependencies must match the plan: each entry the update added or raised, and `next`, `react` and
   `react-dom`, must be installed at a version that satisfies the planned specification; the framework must be
   exactly the planned version.
4. It runs the project gate (which already type checks) and then one `next build`, in place, with no separate `tsc`.
   With `--verify` it runs the project's default verify (`node scripts/verify.ts`) once instead, which is the gate, the build and the
   bounded smoke, so nothing runs twice. The output goes to `evidence/`. Before and after each command it compares the
   protected inputs.
5. When both pass and the inputs still match, it writes the target manifest atomically, marks the session complete and
   moves it to `.meridian/history/<version>/<id>/`, keeping `state.json`, `MERGE.md`, `resolutions.json` and
   `evidence/` and dropping the temporary `base/`, `ours/`, `new/` and `backup/`. A rename that was interrupted is
   recognized by the manifest already being the target's, and only the archival is finished.

A failing check, a failed dependency check or a protected input that changed keeps the session and the project's
current bytes, records the reason in `state.json` and `MERGE.md`, and exits `1`; fix the cause and finalize again.

**Protected and permitted.** Every path in the project is a protected input, except `.git`, dependency contents,
`optional:.meridian/update/`, `optional:.meridian/history/`, `optional:.meridian/update.lock` and the permitted outputs: the Next build folder
(`distDir` when `next.config` sets it as a string, else `.next`), `next-env.d.ts` as Next writes it, `out/`,
`coverage/`, and the TypeScript build-info file (`tsBuildInfoFile`, or `tsconfig.tsbuildinfo` for an incremental
build). A protected path is fingerprinted by existence and SHA-256, in memory; `.env*` files are fingerprinted the same
way, and neither the fingerprints nor any secret is ever written. An output that is a symbolic link, leaves the
project, overlaps a managed or kept file or is a folder holding tracked files is not exempt: finalize stops with that
conflict. A protected file a check rewrites, such as a `tsconfig.json` that Next updates, also fails: review and
commit the change, then finalize again.

**What "complete" means.** The gate and one production build passed on the live project, the files are the target
release's (plus the team's resolutions), and `optional:.meridian/manifest.json` now records the target as the baseline
for the next update. Without `--verify` it does not mean the browser checks ran: the output says `browser: not run`, and
`<pm> run verify` runs the bounded smoke (`<pm> run verify -- --full` the exhaustive suites, `-- --timed` the timed
ones). With `--verify` the output, `MERGE.md` and the archived evidence carry verify's coverage line, which says what
ran and what did not. A failing verify fails the session as a failing gate does.

A zero-conflict update finalizes in the same command: `update` prints the conflict summary and then the finalize
output, exit `0`.

### `--abort`: roll back

It works on an interrupted session, one without an install and one whose install failed. Before restoring anything it
checks that every path the update wrote (the lockfile included) is still the image the update wrote, or already its
original. If a later edit exists, abort refuses, keeps every backup and lists the paths; reconcile them by hand and run
it again. Otherwise it restores only the originals from `backup/`, deletes only what the update created, leaves the
manifest as it was and archives the session as `aborted`. When the lockfile was restored it says so: run `<pm> install`,
because `node_modules` is not restored. No git reset or clean is ever run.

Exit codes of `--finalize`: `0` complete, `2` still pending, `1` failure or refusal. `--resume` ends like a plain
update (`2` pending, `0` finalized, `1` failure). `--abort`: `0` aborted, `1` refused.

## Resolving 0.9.0's migrations

Moving a project to 0.9.0 can report two more `migration:<id>` items, to 0.10.0 a third for an assistant kept from before, to 0.13.0 a fourth for a navigation item without a `needs`, to 0.15.0 a fifth for a page under the project's own route group, and to 0.16.0 five more, for a configuration that does not declare `refusal`, an export gone from a managed module, a view tool without its page or its prepared query, a view tool's page whose specification does not say what the agent does there, and the sample's pages under their old names; to 0.16.2 one more, for a test of the rail standing over a `ResizeObserver` that answers `observe` with nothing, to 0.16.3 three more, for the assistant route's local `onPage`, a file importing the journey from `scripts/navigate.ts` and a route or a read that cuts today at the UTC date, and to 0.16.4 one more, for a file calling `finalOutcome` with a boolean. Each is resolved the same way as those below:

| Id | The old shape it found | The change |
|----|------------------------|------------|
| `share-view-context` | `useShareView(text, structured)`, a sentence and an object | one shared context per view, `useShareView(context)`: `agents.md`, "Legible", and `customize.md`, "A shared context" |
| `agent-reads-section` | a page README under `optional:app/(dashboard)/` or `optional:app/embed/` with no `### What the agent reads` | add the part under `## Agents`: `customize.md`, "A page spec"; checked by the gate |
| `assistant-view-tools` (0.10.0) | an assistant route, `optional:src/lib/assistant/tools.ts` or `optional:src/lib/assistant/respond.ts` kept from before view tools | bring the two files over from the release and pass `views` to `respond` (the template's `viewTools`, your own, or none): `example:docs/assistant.md`, "Adding an MCP server later" |
| `nav-needs` (0.13.0) | an item of `nav` in `src/app.config.ts` with no `needs`, or a `NavItem` type declared without the property | add `needs: 'public'` where everyone may open the page, or `needs: FEATURES.<id>.needs`: `customize.md`, "Navigation", and "5. Decide who may do what" in `optional:docs/start-a-dashboard.md`; checked by the gate |
| `agent-reads-own-group` (0.15.0) | a page README under a route group of the project's own at the top of its app folder (`example:app/(dash)/`) with no `### What the agent reads`: the gate asked only under `optional:app/(dashboard)/` before | add the part under `## Agents`: `customize.md`, "A page spec"; checked by the gate. A copy of the rule in `optional:scripts/check.local.ts` can go |
| `refusal-declared` (0.16.0) | a `src/app.config.ts` with no `export const refusal` | declare `refusal` beside `facts`, `'explain'` to keep the no-access page a refused page draws today or `'absent'`; a project that keeps the sample's access seam brings `optional:src/data/access.ts` and `optional:src/data/refusal.ts` over from the release: `customize.md`, "Navigation: `src/app.config.ts`"; checked by the gate and a build |
| `managed-exports-removed` (0.16.0) | a file of the team's importing `deviations`, `largest`, `runs` or `weekendRatio` from `src/lib/insight.ts`, or `queryInput` from `src/lib/collection.ts` | a file of the sample's comes over from the release (Home's context replaces Overview's; `optional:src/lib/assistant/tools.ts` and `optional:src/lib/assistant/respond.ts` read through `view_<name>` and `explore_<view>`, and the route passes `readable` to `respond`), as does a shipped test that imports one; a file of your own writes the function it needs itself: `agents.md`, "Prepared queries"; checked by the gate and a build |
| `view-tool-page-explore` (0.16.0) | a `defineViewTool` call without `page` or `explore` | add `page`, the console route the view renders, and `explore`, its prepared query (`PreparedQuery` in `src/lib/explore.ts`), beside the view as `example:src/views/<view>-explore.ts`: `agents.md`, "Prepared queries"; checked by the gate and a build |
| `agent-does-here-section` (0.16.0) | the README of a page a view tool's `page` names, with no `### What the agent does here`; while a tool names no page, every console page README without it | add the part under `## Agents`: `Protagonist: <name>.` and at least three `- "<question>" — <what the prepared query is asked>`, the card marked `data-protagonist`: `agents.md`, "Prepared queries"; checked by the gate |
| `sample-pages-renamed` (0.16.0) | the sample's Overview, Analytics and Operations pages and views under their 0.15.0 folders and files, and every file that names them: the view tools, the nav's feature ids, the verify config's routes, a shipped test | a project that kept them as they were brings the release's Home, Usage and Services over with the rest of the sample and its tests, keeping its own `app` in `src/app.config.ts`, and deletes a listed file the release no longer has; a project that made them its own keeps its names and makes the other 0.16.0 changes in them; checked by the gate and a build |
| `marker-measured-on-observe` (0.16.2) | a test that mounts the rail over a `ResizeObserver` whose `observe` answers nothing, such as `optional:tests/rail-marker.test.tsx` as the template wrote it | the rail reads no offset of its own since 0.16.2 — a rail mounts inside the tap that opens the phone drawer, and a read there lays the page out inside that tap — so the marker's first position is the one `observe` delivers, as the platform delivers it, after the effect that called it: bring `optional:tests/rail-marker.test.tsx` over from the release as it has it, whose fake answers `observe` with the callback (`observe() { for (const cb of observers) queueMicrotask(cb); }`), and answer a fake of your own the same way, reading the marker after that delivery; checked by the gate |
| `view-page-matched-as-next` (0.16.3) | `optional:app/api/assistant/route.ts` with a local `function onPage(` | delete `onPage` and find the view with `viewAt` from `@/lib/shared-context`, which matches a catch-all `page` as Next.js does: `const at = viewAt(viewTools, path); const view = at && views.includes(at) ? at : undefined;`; checked by the gate |
| `journey-moved` (0.16.3) | a file of the team's importing anything but `workspaceHomes` from `scripts/navigate.ts`, such as a copy of `optional:tests/navigate-start.test.ts` | the journey moved to `scripts/lib/journey.ts`: bring `optional:tests/navigate-start.test.ts` and `optional:tests/navigate-menu-start.test.ts` over from the release as it has them, and import the journey from `scripts/lib/journey.ts` in a file of your own; checked by the gate |
| `today-in-timezone` (0.16.3) | `optional:app/api/assistant/route.ts` or `optional:src/data/metrics.ts` cutting today with `clock().toISOString().slice(0, 10)` | `dayOf(clock())` from `src/lib/format-date.ts`, so today is the day in `app.timezone`; a file of your own comparing an instant's day with a day row asks `dayOf` too; checked by the gate |
| `verify-tiers` (0.16.4) | a file of the team's importing `finalOutcome` from `scripts/lib/coverage.ts` and calling it with a boolean, such as a copy of `optional:tests/verify-suite-outcome.test.ts` from before the tiers | `finalOutcome` takes `{ full, timed }` since verify has a timed tier: bring `optional:tests/verify-suite-outcome.test.ts` over from the release as it has it, and call `finalOutcome({ full, timed }, notRun)` in a file of your own, as `validation.md` describes; checked by the gate |

A created project that never changed the template's pages brings the release's version of each affected file over, with
the files that arrived with them: the view contexts `optional:src/views/home-context.ts` and its siblings, the view
tools `optional:src/views/tools.ts`, the reads `optional:src/data/metrics.ts` and the collections in
`optional:src/data/collections.ts`. From 0.16.0 that includes `src/app.config.ts`, whose nav names the pages' features
(its own `app` kept), and `scripts/verify.config.ts`, which names their routes; each shipped test comes over as the release
has it, and one the release no longer has is deleted. `src/lib/shared-context.ts`, `src/lib/agent-guidance.ts` and
`src/lib/insight.ts` are Meridian's and arrive with the update. An adopted project builds a context for each view it
shares.

## Resolving 0.5.0's migrations

Moving a project to 0.5.0 can report these ten `migration:<id>` items. Each is a change in the team's own files, so the
update only reports it: `MERGE.md` lists the files it found, and its instructions name the section to follow. Resolve
each one in the project, then record it as above, with the hashes of the files as they are after your change.

| Id | The old shape it found | The change |
|----|------------------------|------------|
| `verify-modes` | a `package.json` script, workflow or shell file passing `--quick`, `--no-vitals` or `--extra` to verify | use `pnpm verify`, `--full`, `--timed` or `--perf` instead: `validation.md`; only the gate runs after it |
| `shell-assistant-promise` | `<AppShell assistant=...>` with a boolean | pass a `Promise<boolean>`: `cache.md`, "The shell's assistant promise" |
| `assistant-available-promise` | `useAssistantAvailable()` read as a boolean | `use(useAssistantAvailable())` inside a `Suspense` boundary: same section |
| `clock-now-required` | `Freshness`, `ShellTools` or `AlertsPanel` without `now`, `formatRelative` with one argument | pass the data's clock: "The clock is the data's" |
| `cache-components-config` | a Next config without `cacheComponents` and `partialPrefetching` | add both flags: "Turn Cache Components on" |
| `connection-boundaries` | a page or layout that awaits `connection()` | remove it and read behind a boundary: same section |
| `authorized-read` | a page calling `.query(` on a collection | `read()` from `optional:src/data/read.ts`: "Authorized, scoped reads" |
| `scoped-invalidation` | a Server Action that writes and invalidates nothing | `updateTag` after the commit: "Writes authorize, then invalidate" |
| `live-provider` | collections without `optional:src/data/live-actions.ts`, or a console layout without the provider | add the live files: `live.md`, "The live starters" and "Refreshing" |
| `authorized-endpoints` | the assistant route or an actions file that never calls `resolveAccess` | resolve the caller first, and bring `optional:src/lib/assistant/tools.ts` and `optional:src/lib/assistant/respond.ts` over, which take the guard: "The assistant route" |

Every migration but `verify-modes` is checked by the gate and a build; `verify-modes` by the gate alone. After 0.5.0 the gate alone checks `agent-reads-section`, `nav-needs`, `agent-reads-own-group`, `agent-does-here-section`, `marker-measured-on-observe`, `view-page-matched-as-next`, `journey-moved`, `today-in-timezone` and `verify-tiers`.

How to make the change depends on whose file it is:

- **A project created from Meridian that never changed the template's pages** (a file as the earlier release wrote it):
  bring the release's version of each affected file over. Take it from the installed package's template or from
  `https://github.com/zhixuan312/zz-meridian` at the version `MERGE.md` names, never from memory. The release's
  versions need the files that arrived with them: the starters `optional:src/data/access.ts`,
  `optional:src/data/read.ts`, `optional:src/data/live-stream.ts`, `optional:src/data/live-actions.ts` and
  `optional:app/api/live/route.ts`, the client `optional:src/views/console-live.tsx`, each console route's
  `loading.tsx`, and the assistant's route-side code (`optional:src/lib/assistant/tools.ts` and
  `optional:src/lib/assistant/respond.ts`, which take the guard). Remove a file the release moved (the Home page is now under `optional:app/(dashboard)/(home)/`),
  and carry over your own changes to a file you had edited; do not overwrite them.
- **A project adopted into an existing app**, whose pages are its own: make the smallest edit the instruction names. A
  Next config that lacks the two flags gets them, and then each route must still be static or partial; the pages Meridian
  never wrote stay as they are. Do not copy Meridian's pages into an app that did not have them.
- **A breaking change with no migration.** Some interfaces change in a file only one origin has, or arrive with the
  update itself: `filterRequests` is gone and `RequestsView` and `KeysView` take new props (a created project takes the
  release's page and view; an adopted one never had them); `src/lib/collection.ts` is Meridian's now, with `zod` as a
  dependency; a custom accent is set in `src/app.config.ts` alone, not in `src/lib/preferences.ts`. Meridian's own
  files and the dependencies arrive with the update, and a conflict is staged like any other.
- **A change that does not apply** (a page that awaits `connection()` on purpose, a `.query(` that is not a collection):
  record the migration as `not-applicable` with the reason, in one sentence.

Then run `<pm> run gate` and one `next build` yourself before the pinned `--finalize`, which runs both again and refuses
anything that still fails.

## What to do with it

1. Run it from a clean git tree, so the report describes the project and not unfinished work.
2. Report the conflicts to the person in their own words: which files, what the team changed, what Meridian changed.
3. Do not edit `optional:.meridian/manifest.json` to make a line go away: the manifest is how the next update knows
   what was copied.
4. Resolve each item as above, then run the pinned finalization command.

## Keeping a file on purpose: the keep register

A team that wants to keep its own version of a managed file lists it in `optional:.meridian/keep.json`. The file is a
JSON array of exactly `{ "path", "reason" }` entries. Paths are unique, project-relative and posix (no leading `/`, no
`..`), and every reason says why in a sentence.

```json
[{ "path": "src/components/ui/card/index.tsx", "reason": "Our card has a different header by design." }]
```

- A kept path must be a file Meridian manages, or one a completed update retired and left in place. Any other path
  fails the gate.
- A kept file that is missing fails the gate. An update never recreates it: restore the file or remove the entry.
- Do not add an entry to make a conflict disappear without reading it. The reason is the record of the decision.

## An unresolved session fails the gate

While an update session exists under `optional:.meridian/update/`, `node scripts/check.ts` (and so `pnpm gate`) refuses
it until every open item is resolved: an interrupted apply (run `update --resume`), an edited plan, a write that was
never applied, a staged file or a migration without exactly one current resolution, and any unknown or duplicate
resolution. More than one session fails too. When the session is ready, the gate reads its candidate manifest in place
of the recorded one for the keep register, retirements and the dormant-export sweep. Resolve as `MERGE.md` says, then
run `npx zz-meridian@<version> update --finalize`.
