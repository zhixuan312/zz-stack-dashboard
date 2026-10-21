# Update 0.25.1 to 0.26.0

- Source: 0.25.1
- Target: 0.26.0
- Route: adopt
- Session: 20261021T190429586Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.26.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.26.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.26.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:table-grid

A table is a grid since 0.26.0: its spare width sits in the gaps, a `grow` column's floor is 160px at every width, and a cell spans no columns.

Paths: `src/console/plugin-eval-overview.tsx`, `src/console/settings/teams-panel.tsx`

Bring `tests/table-cut-cell.test.tsx` over from the release as it has it. Since 0.26.0 `src/components/ui/table/index.tsx` lays a table out as a grid whose rows are subgrids: every column is as wide as its content, the spare is shared equally between the gaps, and a `grow` column's floor is `min-w-40` at every width, without the `@min-[672px]:min-w-64` it had from a 672px table. A test of your own that expects that class expects `min-w-40` alone. A `TableCell` of your own with a `colSpan` takes one track of the grid, so it draws in the first column only: a row that should run the width of the table, such as an empty state, is drawn outside the table, or as a `DataTable` `empty`.

Checks:

- `gate`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:table-grid",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/console/plugin-eval-overview.tsx": "sha256-ec97a4fa3cb2cb8aaef5ed9c309c9a78c4a20379c200af94df08871b90f249d9",
    "src/console/settings/teams-panel.tsx": "sha256-8fa2e54842996cebc211273ab0dfa2e8a33b592f89e7a1e61f2c5e395371b250"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `src/console/plugin-eval-overview.tsx`
- `src/console/settings/teams-panel.tsx`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 1
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 178
- untouched/write: 8

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        leave   .agents/skills/zz-meridian/references/customize.md
untouched        leave   .agents/skills/zz-meridian/references/existing-project.md
untouched        leave   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        leave   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        leave   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        leave   .claude/skills/zz-meridian/references/cache.md
untouched        leave   .claude/skills/zz-meridian/references/customize.md
untouched        leave   .claude/skills/zz-meridian/references/existing-project.md
untouched        leave   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        leave   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        leave   scripts/audit.ts
untouched        leave   scripts/brand.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        leave   scripts/interactions.ts
untouched        leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        leave   scripts/lib/journey.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/phone.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/shard.ts
untouched        leave   scripts/lib/sizes.ts
added            write   scripts/lib/slots.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        leave   scripts/navigate.ts
untouched        leave   scripts/perf.ts
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
untouched        write   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/index.tsx
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
untouched        write   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/assistant/prompt.ts
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

The target release's changelog sections above 0.25.1:

```markdown
## [0.26.0] · 2026-10-22

### Breaking

- **A table puts its spare width in the gaps between its columns, an equal share in each.** `Table` is laid out as a CSS grid now, not by the table algorithm. Every column is as wide as its content. `justify-content: space-between` spreads the spare across the gaps, so every gap is the same whatever each column's alignment. In 0.25 the table algorithm put a column's spare inside the column, after a left-aligned value and before a right-aligned one. So a gap between a text column and a number held both columns' shares, and the gap after the number held none. Measured from the ink of one column to the ink of the next at 1920px, the gaps on /customers, /members and /tests now vary by 0 to 3% (a coefficient of variation of 0.00 to 0.03), against 42 to 53% in 0.25.1.
  - **Rows are subgrids** of the table's columns, so a row's border, its hover and its selection run across the gaps. The header row carries the sunk background and the rules.
  - **The table counts its columns** from the cells of its first row as its own JSX writes them: the head's `TableHeader` cells when it has a head, otherwise the first row's `TableCell` cells. It counts one track per column at each `hideBelow` step. Write that row's cells in the table's own JSX, not inside a component of your own, or the table cannot count them.
  - **Cells are blocks in a grid.** A cell no longer sets the row height or centres itself: the row is at least `--row-height` tall and centres its cells. A cell you styled as a table cell (`align-middle`, a fixed height, a `colSpan`) is now laid out by its row; drop those classes.
  - **The `grow` floor is 160px at every width.** It was 256px from a 672px table. A floor is also a width the column claims when its names are shorter, so the gap after the lead was half as wide again as every other gap.
  - **A text column after a number no longer takes extra left padding** (`pl-8`). With equal gaps it made one gap wider than the rest.
  - **`DataTable`'s selection checkbox sits over the lead column's left padding**, not in a column of its own, so no gap stands between a checkbox and the name it selects. It is still its own cell, first in the row, marked `data-check`. The table does not count it.
  - **`update` lists `migration:table-grid`** for a project whose own files expect the old floor (`@min-[672px]:min-w-64`, as `tests/table-cut-cell.test.tsx` did in a project created before 0.26.0) or give a `TableCell` a `colSpan`, which a grid row draws in one track. Bring the release's `tests/table-cut-cell.test.tsx` over, and draw a row that spans the table, such as an empty state, outside it or as a `DataTable` `empty`.
  - Rows, cells and row groups carry their ARIA roles (`row`, `cell`, `columnheader`, `rowgroup`, `table`), since a table laid out as a grid can lose its native semantics in some browsers.

### New

- **`pnpm verify --browsers <n>`: one run holds at most `n` browsers at once** ([#77](https://github.com/zhixuan312/zz-meridian/issues/77)).
  - Without the flag, the ceiling is one browser per two CPUs and per 4 GiB of memory, whichever is fewer. `--full`'s audit, presses, keyboard walk and product checks start under the ceiling, not all at once.
  - A check in `browserChecks` holds one browser, or the number its entry names: `{ script, browsers }`, the whole ceiling at most. It starts once that many are free and is told in `VERIFY_BROWSERS` how many it holds, so a check that pools browsers sizes its pool from that number, not from the machine. The sample's journey drives three people at once and declares `browsers: 3`.
  - The trace header prints the ceiling used, for example `browsers: at most 5 at once (10 CPUs and 32 GiB)`.
  - Without a ceiling, one run on a 32 GB laptop held about 70 Chrome processes and pushed the machine about 17 GB into swap.
```

