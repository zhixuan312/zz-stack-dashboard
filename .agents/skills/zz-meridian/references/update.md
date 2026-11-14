# Updating a project built on Meridian

Run `npx zz-meridian@latest update --dry-run` first: it shows what moving this project to the running version of
Meridian would change, and which of those changes need the team's decision. It writes nothing in the project (it fetches
the recorded release from the registry, and works in a temporary folder). A plain
`npx zz-meridian@latest update` then applies the safe changes and stages the rest. Do not copy files by hand to make up
for either.

When the project is already on the running version, `update` (and its dry run) prints
`already at <version>; nothing to update` and exits 0: say so in the hand-over and stop there; the standard is not
re-proven for a change that did not happen. After an update that changed files, run the loop in `standard.md` on what it
changed, and close with `pnpm test:release` and the browser diagnostics. A release can make a suite look further than the last one did (the
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
- **Tests**: only `tests/setup.ts` is Meridian's in a created project; `optional:tests/examples/` is the team's starting point and
  stays the team's. A test an earlier release shipped is deleted when the team left it untouched and staged when it
  edited it.
- **Never touched**: files in the keep register, team-owned files, and a file the recorded release shipped that a
  created project never received — `create` removes the Atlas after copying, so an update leaves it out
  rather than reading its absence as a deletion to restore. The only team files an update edits are
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
| `evidence/` | the output of the install and, when finalizing, `test:t1`, the build, the route policy and the size checks |

`optional:.meridian/update.lock` exists while a run is in progress. A lock that is left behind refuses every new update
and names itself and the session phase; an update never deletes it for you.

## Reading the output

Only the paths that need a decision are listed, one per line: the kind of change, the path, then what to do.

```
collision        src/components/ui/card/index.tsx  merge required
local-deletion   scripts/audit.ts  decide: delete or restore
migration  dependency:zod  pending
summary: 2 conflicts · aggregated: untouched 310, edited 3, added 4, removed 1, team-preserved 12, kept 1
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
hash. Exactly one resolution per item; unknown or duplicate ones fail the checks.

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
4. It runs `node scripts/test-run.ts t1` (the Tier 1 tests affected by the change, the static checks and the type
   check), then one `next build`, in place. `node scripts/route-policy.ts` follows when the project's Next config sets
   `cacheComponents` and `partialPrefetching`; `node scripts/sizes.ts` follows when `optional:scripts/verify.baseline.json` is
   one that the team recorded (it carries `recordedBy: "sizes.ts"`) and differs from the release's. A check that does not run
   is reported `not run` with the reason, never as passed. The output goes to `evidence/`. Before and after each
   command it compares the protected inputs.
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

**What "complete" means.** The Tier 1 tests affected by the change, the static checks and the type check passed, one
production build passed on the live project, the route policy and the size checks passed where the project supplies
what they read (and were reported `not run` with the reason where it does not), the files are the target release's
(plus the team's resolutions), and
`optional:.meridian/manifest.json` now records the target as the baseline for the next update. `test:release`, the
browser diagnostics and the Postgres suite are the team's own gate before it ships, not part of finalize. A failing
check or build fails the session.

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

## Resolving a migration

A migration is a change beyond copying files that the team must make: a dependency, a script, a release's own change.
`MERGE.md` is the file that reports it, and it carries each migration's own instruction: the id, the summary of what it
found, the paths it found it in, and the text to follow. That instruction is the whole of the change. The section it
sends you to is in this skill, one of the references beside this file, or where the instruction names a guide of
Meridian's, that guide; no per-release table lives here. Resolve each item in the project, then record it as above, with
the hashes of the files as they are after your change.

How to make the change depends on whose file it is:

- **A project created from Meridian that never changed the template's pages** (a file as the earlier release wrote it):
  bring the release's version of each affected file over. Take it from the installed package's template or from
  `https://github.com/zhixuan312/zz-meridian` at the version `MERGE.md` names, never from memory. The release's versions
  need the files that arrived with them, which the instruction names; carry over your own changes to a file you had
  edited, and do not overwrite them.
- **A project adopted into an existing app**, whose pages are its own: make the smallest edit the instruction names. Do
  not copy Meridian's pages into an app that did not have them.
- **A breaking change with no migration.** Some interfaces change in a file only one origin has, or arrive with the
  update itself: Meridian's own files and the dependencies come with it, and a conflict is staged like any other.
- **A change that does not apply** (a page that awaits `connection()` on purpose, a `.query(` that is not a collection):
  record the migration as `not-applicable` with the reason, in one sentence.

Every migration names the command that proves it: `pnpm test:t1` alone where a test run is enough, `pnpm test:t1` and one
`next build` where the change reaches the build, and `pnpm test:release` where the browser suites are its subject. None
takes an argument: the command selects the tests. Run `pnpm test:t1` and one `next build` yourself before the pinned
`--finalize`, which runs them again, with the route policy and the size checks, and refuses anything that still fails.

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
  fails the checks.
- A kept file that is missing fails the checks. An update never recreates it: restore the file or remove the entry.
- Do not add an entry to make a conflict disappear without reading it. The reason is the record of the decision.
- A managed file whose bytes are not the release's and that no entry keeps is named by the static checks, on a `drift:` line
  after their last line. It is a warning, not a failure: the next update asks about
  each, and it can tell a file whose imports are only spelled differently from one the team changed, which the checks
  cannot. Restore the file to the release, or keep it here with its reason, so the question is answered before the
  update asks it.

## An unresolved session fails the checks

While an update session exists under `optional:.meridian/update/`, `node scripts/check.ts` (and so every test command) refuses
it until every open item is resolved: an interrupted apply (run `update --resume`), an edited plan, a write that was
never applied, a staged file or a migration without exactly one current resolution, and any unknown or duplicate
resolution. More than one session fails too. When the session is ready, the checks read its candidate manifest in place
of the recorded one for the keep register, retirements and the dormant-export sweep. Resolve as `MERGE.md` says, then
run `npx zz-meridian@<version> update --finalize`.
