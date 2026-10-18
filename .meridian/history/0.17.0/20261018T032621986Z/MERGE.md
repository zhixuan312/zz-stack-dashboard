# Update 0.16.3 to 0.17.0

- Source: 0.16.3
- Target: 0.17.0
- Route: adopt
- Session: 20261018T032621986Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.17.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.17.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.17.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:dependency:jsdom

jsdom ^30.1.2 is newer than the tested ^30.1.1

Paths: `package.json`

Meridian is tested against jsdom ^30.1.1; your ^30.1.2 is newer and was left as it is. Run the project's gate and build with it, and read the jsdom release notes for breaking changes before relying on it.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:dependency:jsdom",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-ae724d13f64a9296964f54a392286307b5721f9e3ce1d63d1cc804011640211d"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `package.json`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 154
- untouched/write: 27

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        write   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        write   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        write   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        leave   .claude/skills/zz-meridian/references/cache.md
untouched        write   .claude/skills/zz-meridian/references/customize.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        write   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        write   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        write   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        leave   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        leave   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        write   scripts/gate.ts
untouched        write   scripts/interactions.ts
untouched        leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        write   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        write   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
untouched        write   scripts/lib/journey.ts
untouched        leave   scripts/lib/next-config.ts
untouched        write   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        leave   scripts/tokens.ts
untouched        write   scripts/verify.ts
untouched        leave   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        leave   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        write   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        leave   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        leave   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/index.tsx
untouched        leave   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/patterns/status-list/summarise.ts
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        leave   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        write   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        leave   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/explore.ts
untouched        leave   src/lib/facts.ts
untouched        leave   src/lib/format-date.ts
untouched        leave   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        leave   src/lib/insight.ts
untouched        leave   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/styles/base.css
untouched        leave   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        leave   src/styles/tokens.css
untouched        leave   src/views/console-chrome.tsx
untouched        leave   tests/setup.ts
untouched        leave   tokens/accent.brand.tokens.json
untouched        leave   tokens/accent.cobalt.tokens.json
untouched        leave   tokens/accent.graphite.tokens.json
untouched        leave   tokens/accent.indigo.tokens.json
untouched        leave   tokens/accent.jade.tokens.json
untouched        leave   tokens/core.tokens.json
untouched        leave   tokens/density.compact.tokens.json
untouched        leave   tokens/palette.tokens.json
untouched        leave   tokens/theme.dark.tokens.json
untouched        leave   tokens/theme.light.tokens.json
untouched        leave   tokens/zz-meridian.resolver.json
```

</details>

## Verify

Finalizing runs the project gate and one build. To check by hand first:

```
pnpm run gate
node node_modules/next/dist/bin/next build
```

## Changelog

The target release's changelog sections above 0.16.3:

```markdown
## [0.17.0] · 2026-10-18

### Breaking

- **`pnpm verify --full` no longer judges a time.** It runs the complete suites: every rail route navigated for its function, the audit, every control pressed and link followed, the keyboard walk, the assistant and the product's own browser checks. The navigation budgets, the live-data suite and Web Vitals moved to the new `pnpm verify --timed`, which runs them alone and last and needs a quiet machine. Only `pnpm verify --full --timed` can end `the project meets the Meridian standard`; a `--full` run with nothing else unrun ends `every check that ran passed; not run: timing, live, vitals; pnpm verify --timed runs them`. A script, workflow or agent prompt that ran `--full` for the whole standard runs `--full --timed` instead; weekly CI runs `pnpm verify --full --timed --perf`. `docs/testing.md` classifies every check by size, type and tier.
- **`pnpm verify` and `--full` no longer fail a route for being slow.** Their navigation (`scripts/navigate.ts --timing off`) judges whether each route's shell, data and first interaction arrive, never how fast; `pnpm verify --timed` judges the same journeys against `budgets.navigation`. A project that relied on the default smoke to catch a slow route runs `pnpm verify --timed` on a quiet machine.
- **`pnpm gate` no longer runs `tests/deep-*`**, the browser-fixture tests of the checks, which only this repository has. Its closing line names the command that does: `pnpm exec vitest run tests/deep- --no-file-parallelism`.
- **The coverage line has new words.** Its depth can be `timed`, `full+timed` or `full+timed+perf`, and its `not run:` list can name `timing`. A script that matched `coverage: full;` for a complete run matches `coverage: full+timed;` and `not run: none`.
- **`finalOutcome` (`scripts/lib/coverage.ts`) takes `{ full, timed }` in place of a boolean.** A project's own copy of `tests/verify-suite-outcome.test.ts` from before the tiers calls `finalOutcome(true, …)` and failed its update's gate at the type check; the update now reports it as the `verify-tiers` migration. Bring `tests/verify-suite-outcome.test.ts` over from the release, and call `finalOutcome({ full, timed }, notRun)` in a file of your own.

### New

- **A Featured metric can say its period has no number** ([#45](https://github.com/zhixuan312/zz-meridian/issues/45)). `FeaturedFigure.value` is `number | null`, and `points` takes `null` entries. With no number, the figure's line holds `missing`, the caller's words ("No words recorded", "Unavailable"; "Not recorded" by default), a size down and at the figure's own height, so a period without a number draws the same card as one with. A pointed point that is `null` reads the same way. Before this, the only ways through were a false `0`, or `NaN` with a `format` that turned it into a word; a card that did the second can pass `null` and `missing` now.

### Changed

- **`docs/testing.md` is the testing standard.** Above its classification it says what kinds of test there are (size and type), the tiers that combine them, when each runs (while editing, before a commit, before finishing and handing over a change, before a release, when a given kind of change is made, and on a schedule), and the rules a red, a limit and a release follow, with the practice they rest on. A project is advised to follow it and Meridian follows it. `AGENTS.md`, `CONTRIBUTING.md`, `docs/distribution.md` and `references/validation.md` point to it instead of keeping their own account, and `tests/cli-testing-standard.test.ts` keeps its shape.

### Fixed

- **The assistant is told it changes nothing where it is handed no write tool** ([#46](https://github.com/zhixuan312/zz-meridian/issues/46)). The system prompt always said "Your write tools change what this page shows…" and that the person approves each Proposal, even on a page whose collections the assistant may only read, where no write tool is built and no Proposal can follow. `respond` now tells `systemPrompt` whether it handed a write tool (`Audience.writes`). Without one, the prompt says the assistant changes nothing and, asked for any change, gives the page that makes it, or says it is not a change the person can make. With one, it keeps both lines. The shared guidance that no change exists unless a write tool returned one stays in both.
- **`ask` writes one transcript a page and can ask a detail page on the record you name** ([#47](https://github.com/zhixuan312/zz-meridian/issues/47)). A page with no view tool was named by its folder, a detail page by the folder before its `[id]`, so `/things` and `/things/[id]` both wrote `things.md` and the second overwrote the first. A page without a tool is now named by its whole route (`/things/[id]` is `things-id`), two views that would share a name are told apart by their routes, and a name still shared is refused before anything is asked. `--view` takes the assistant's tool name as well (`view_usage`), and `--path <address>` asks the page that renders that address on that record, rather than on the first row its listing draws, which may be a closed one. The view names from tools defined in modules the registry imports came with #43. A transcript of a page without a tool has a new file name: compare the new file with the old one, under its new name.
- **Pointing at a Featured metric's chart moves nothing below the figure** ([#44](https://github.com/zhixuan312/zz-meridian/issues/44)). A figure given `points` and no `delta` drew the row under the figure only while a point was pointed at, so the card grew by the point pill's row as the pointer crossed its chart and shrank when it left: measured at 390 px, 380 → 426 px, and a control below moved 46 px with it, enough for a press aimed at it to land on something else. The row is now drawn at rest as a line of its own, holding the pill's place empty, so the card stays 426 px either way however long the point's name.
- **The gate and `ask` find a view tool kept in a module of its own** ([#43](https://github.com/zhixuan312/zz-meridian/issues/43)). `viewToolPages()` (`scripts/lib/routes.ts`) read the `defineViewTool` calls written in `src/views/tools.ts` alone, so a project that keeps each tool in a module the registry imports got an empty list. `scripts/check.ts` then asked no page for its `### What the agent does here` — green by absence — and `scripts/ask.ts` named every view by its page's folder, never by its tool. It now reads every project module the registry reaches through its imports, by a relative path or a tsconfig alias, an `index` included. A project whose tools sat in such modules can find pages failing `check.ts` that passed before: each is a page a tool names whose specification lacks the part, and the fix is that part.
- **Home and Revenue are live pages.** Each body registers the collections its feature needs with `useLive`, so `/` and `/business` resync on open, on reconnect and on the safety poll, and `pnpm verify --perf` finds an after-live start for every Home and Business route again: since the rails became per workspace, `/members`, `/customers`, `/usage` and `/requests` had none (`no other rail route registers live data to start from`).
- **A link probe is pressed once the destination's data is measured.** The navigation measured the data and pressed the probe side by side, so on a route whose link is ready before its ready text (`/business`, while its title still loaded) the press could leave before the data counted, and a sample failed `main is there but never shows`. A dead link is still reported.
- **Switching an Atlas card's theme no longer drops a frame on a phone.** The stage's specimen sections are skipped by style and layout until they near the viewport (`content-visibility: auto`), so the Theme, Accent, Density and Width switches restyle only what is on screen; a chart pattern's specimen holds thousands of elements, and the switch cost one frame of 100 to 160 ms on a mid-range phone.
- **`pnpm verify --perf` holds a route to the budget its navigation check carries**, as `pnpm verify --timed` already did. A route's own figure (`budget` on its check in `verify.config.ts`) now stands in for the shared warm figure in both suites, through one function (`limitsFor` in `scripts/lib/budgets.ts`), so the two no longer judge one route against two bars: the start guide's phone warm shell is reported against its own 300 ms, not the shared 250 ms. Cold and after-live keep the shared figures.
- **The Atlas's Contributing page no longer links to a page that answers 404.** It linked `docs/testing.md` relatively, which resolved to `/system/system/docs/testing.md`; the file is now named in backticks, as every other Atlas document names a file, and `tests/cli-atlas-doc-links.test.ts` keeps every document the Atlas serves free of relative links.

### Known issues

- **`node scripts/audit.ts --atlas` reports overlaps on the Atlas pattern pages whose specimen renders with `content-visibility: auto`** (featured metric, metric tile, column chart, heatmap and the records template). The pages draw nothing overlapping: the audit measures sections the browser has not laid out yet. Fixed in the next release. `pnpm verify` and its tiers are not affected.
- **`node scripts/vitals.ts --atlas` can drop one frame on a page specification's look control** (`/system/pages/revenue`, one run in three), where the stage restyles its console and phone frames in one tap. Fixed in the next release. `pnpm verify --timed` is not affected.
```

