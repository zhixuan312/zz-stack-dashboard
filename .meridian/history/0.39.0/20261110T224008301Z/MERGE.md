# Update 0.36.0 to 0.39.0

- Source: 0.36.0
- Target: 0.39.0
- Route: adopt
- Session: 20261110T224008301Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.39.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.39.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.39.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### file:.agents/skills/zz-meridian/SKILL.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/SKILL.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/SKILL.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/SKILL.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/SKILL.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/SKILL.md": "sha256-4da6153359d8188918fd05596106260c669fe637e7e467bf19f2b6832848656c"
  }
}
```

### file:.agents/skills/zz-meridian/references/customize.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/references/customize.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/references/customize.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/references/customize.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/customize.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/customize.md": "sha256-4d6748a56e5c52b1f103973b48dd81ef61768a688e375dfba7fbf059533cb04a"
  }
}
```

### file:.agents/skills/zz-meridian/references/existing-project.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/references/existing-project.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/references/existing-project.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/references/existing-project.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/existing-project.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/existing-project.md": "sha256-fe3a4952856c91530090531c492524c4ff4b3a9c0947cf744ed064d056e69a4d"
  }
}
```

### file:.agents/skills/zz-meridian/references/ownership.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/references/ownership.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/references/ownership.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/references/ownership.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/ownership.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/ownership.md": "sha256-f7a5d761ee0fe3f5691d63fb33e54cf6711c19275673c0c641ae469f934406ab"
  }
}
```

### file:.agents/skills/zz-meridian/references/update.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/references/update.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/references/update.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/references/update.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/update.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/update.md": "sha256-6035964eed5403d52f79266c9532b535a93210a598e608f0d1fd40d123af0192"
  }
}
```

### file:.agents/skills/zz-meridian/references/validation.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.agents/skills/zz-meridian/references/validation.md`
- ours: `.meridian/update/0.39.0/ours/.agents/skills/zz-meridian/references/validation.md`
- new: `.meridian/update/0.39.0/new/.agents/skills/zz-meridian/references/validation.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/validation.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/validation.md": "sha256-451f5886401db2ec2402d55ad775e2f0dc5b7c0e8986bbaf54a393d4e5e2c9ab"
  }
}
```

### file:.claude/skills/zz-meridian/SKILL.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/SKILL.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/SKILL.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/SKILL.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/SKILL.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/SKILL.md": "sha256-4da6153359d8188918fd05596106260c669fe637e7e467bf19f2b6832848656c"
  }
}
```

### file:.claude/skills/zz-meridian/references/customize.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/references/customize.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/references/customize.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/references/customize.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/customize.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/customize.md": "sha256-4d6748a56e5c52b1f103973b48dd81ef61768a688e375dfba7fbf059533cb04a"
  }
}
```

### file:.claude/skills/zz-meridian/references/existing-project.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/references/existing-project.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/references/existing-project.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/references/existing-project.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/existing-project.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/existing-project.md": "sha256-fe3a4952856c91530090531c492524c4ff4b3a9c0947cf744ed064d056e69a4d"
  }
}
```

### file:.claude/skills/zz-meridian/references/ownership.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/references/ownership.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/references/ownership.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/references/ownership.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/ownership.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/ownership.md": "sha256-f7a5d761ee0fe3f5691d63fb33e54cf6711c19275673c0c641ae469f934406ab"
  }
}
```

### file:.claude/skills/zz-meridian/references/update.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/references/update.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/references/update.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/references/update.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/update.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/update.md": "sha256-6035964eed5403d52f79266c9532b535a93210a598e608f0d1fd40d123af0192"
  }
}
```

### file:.claude/skills/zz-meridian/references/validation.md

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.39.0/base/.claude/skills/zz-meridian/references/validation.md`
- ours: `.meridian/update/0.39.0/ours/.claude/skills/zz-meridian/references/validation.md`
- new: `.meridian/update/0.39.0/new/.claude/skills/zz-meridian/references/validation.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/validation.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/validation.md": "sha256-451f5886401db2ec2402d55ad775e2f0dc5b7c0e8986bbaf54a393d4e5e2c9ab"
  }
}
```

### file:scripts/test-run.ts

collision: Meridian now ships this path and you already have a different file there. Decide which one stays, or combine them.

- base: `absent`
- ours: `.meridian/update/0.39.0/ours/scripts/test-run.ts`
- new: `.meridian/update/0.39.0/new/scripts/test-run.ts`

Resolution stub:

```json
{
  "id": "file:scripts/test-run.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/test-run.ts": "sha256-04ef3bf7708606f299d0926c45353af8adf3fa612ea6e41dbbd5b10e5fabd334"
  }
}
```

### migration:open-command-moved

`openCommand` and `usePaletteKey` moved to `src/components/patterns/command-palette/open.ts`, so the palette can be a chunk of its own.

Paths: `tests/member-chrome.test.tsx`, `tests/workspace-chrome.test.tsx`

Since 0.37.0 the Command palette loads with `next/dynamic` and is in no page's first load, so the two things a page needs before it opens, `openCommand` and `usePaletteKey`, live in `src/components/patterns/command-palette/open.ts` and the palette's own file no longer exports them. In each file listed, import them from `@/components/patterns/command-palette/open`. Mount the palette the way `src/views/console-chrome.tsx` does, through `dynamic()`, or importing it puts it back in every page's first load.

Checks:

- `test:t1`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:open-command-moved",
  "status": "resolved",
  "reason": "",
  "files": {
    "tests/member-chrome.test.tsx": "sha256-0e0f4c1cf8d1c3f4a2fd5bbee3ccf1074003ca30b055e18e93d32ac06088458d",
    "tests/workspace-chrome.test.tsx": "sha256-fc383f030f11a39d295d249fd853368a81793fc7d5e690e293fd12d5513ce6f2"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `tests/member-chrome.test.tsx`
- `tests/workspace-chrome.test.tsx`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/leave: 1
- added/write: 17
- collision/stage: 1
- edited/leave: 10
- edited/stage: 12
- kept/leave: 3
- removed/delete: 5
- team-preserved/write: 1
- untouched/leave: 101
- untouched/write: 79

<details><summary>Every path</summary>

```
edited           stage   .agents/skills/zz-meridian/SKILL.md
edited           leave   .agents/skills/zz-meridian/references/agents.md
edited           leave   .agents/skills/zz-meridian/references/cache.md
edited           stage   .agents/skills/zz-meridian/references/customize.md
edited           leave   .agents/skills/zz-meridian/references/data-layers.md
edited           stage   .agents/skills/zz-meridian/references/existing-project.md
edited           leave   .agents/skills/zz-meridian/references/live.md
edited           stage   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
edited           leave   .agents/skills/zz-meridian/references/standard.md
edited           stage   .agents/skills/zz-meridian/references/update.md
edited           stage   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
edited           stage   .claude/skills/zz-meridian/SKILL.md
edited           leave   .claude/skills/zz-meridian/references/agents.md
edited           leave   .claude/skills/zz-meridian/references/cache.md
edited           stage   .claude/skills/zz-meridian/references/customize.md
edited           leave   .claude/skills/zz-meridian/references/data-layers.md
edited           stage   .claude/skills/zz-meridian/references/existing-project.md
edited           leave   .claude/skills/zz-meridian/references/live.md
edited           stage   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
edited           leave   .claude/skills/zz-meridian/references/standard.md
edited           stage   .claude/skills/zz-meridian/references/update.md
edited           stage   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        write   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        write   scripts/brand.ts
added            write   scripts/browser.ts
untouched        write   scripts/check.ts
untouched        write   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
removed          delete  scripts/gate.ts
untouched        write   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
untouched        write   scripts/lib/aliases.ts
untouched        write   scripts/lib/answered.ts
untouched        leave   scripts/lib/args.ts
untouched        leave   scripts/lib/atlas.ts
added            write   scripts/lib/attribution.ts
untouched        write   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
untouched        leave   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
added            write   scripts/lib/consumer-smoke.ts
untouched        leave   scripts/lib/context-check.ts
removed          delete  scripts/lib/contrast-pairs.ts
untouched        write   scripts/lib/coverage.ts
untouched        write   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
added            leave   scripts/lib/effective-manifest.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        write   scripts/lib/journey.ts
added            write   scripts/lib/jsonc.ts
untouched        write   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
added            write   scripts/lib/lint.ts
added            write   scripts/lib/live-arrival.ts
untouched        leave   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
added            write   scripts/lib/ownership-guide.ts
untouched        write   scripts/lib/phone.ts
untouched        write   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
removed          delete  scripts/lib/shard.ts
untouched        write   scripts/lib/sizes.ts
removed          delete  scripts/lib/slots.ts
added            write   scripts/lib/summary.ts
untouched        leave   scripts/lib/team-config.ts
added            write   scripts/lib/tier2.ts
untouched        leave   scripts/lib/timing.ts
untouched        write   scripts/lib/update-session.ts
untouched        write   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        write   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        write   scripts/route-policy.ts
untouched        write   scripts/shot.ts
untouched        write   scripts/sizes.ts
collision        stage   scripts/test-run.ts
untouched        write   scripts/tokens.ts
removed          delete  scripts/verify.ts
untouched        write   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        write   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        write   src/components/base/shell/leave-question.tsx
untouched        write   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        write   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/bar-list/levels.tsx
untouched        write   src/components/charts/column-chart/grouped.tsx
untouched        write   src/components/charts/column-chart/index.tsx
untouched        write   src/components/charts/column-chart/shared.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/diverging-bars/index.tsx
untouched        write   src/components/charts/heatmap/index.tsx
added            write   src/components/charts/interval-timeline/index.tsx
untouched        write   src/components/charts/meridian/index.tsx
added            write   src/components/charts/range-strip/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        write   src/components/charts/sparkline/index.tsx
untouched        write   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-settled.ts
untouched        leave   src/components/charts/use-size.ts
added            write   src/components/charts/xy-line-chart/index.tsx
untouched        write   src/components/patterns/activity-feed/index.tsx
untouched        write   src/components/patterns/appearance-menu/index.tsx
untouched        write   src/components/patterns/ask-about/index.tsx
untouched        write   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        write   src/components/patterns/command-palette/index.tsx
added            write   src/components/patterns/command-palette/open.ts
untouched        write   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        write   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        write   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        write   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/index.tsx
untouched        write   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/rail/trail.ts
untouched        write   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        write   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        write   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
added            write   src/components/ui/combobox/index.tsx
untouched        write   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        write   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/disclosure/index.tsx
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/index.tsx
untouched        write   src/components/ui/menu/index.tsx
untouched        write   src/components/ui/pagination/index.tsx
untouched        write   src/components/ui/popover/index.tsx
untouched        write   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        write   src/components/ui/search-input/index.tsx
untouched        write   src/components/ui/segmented/index.tsx
untouched        write   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        write   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        write   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        write   src/lib/assistant/prompt.ts
added            write   src/lib/calendar-date.ts
untouched        write   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
added            write   src/lib/contrast-pairs.ts
untouched        write   src/lib/csv.ts
untouched        write   src/lib/explore.ts
untouched        leave   src/lib/facts.ts
kept             leave   src/lib/format-date.ts
untouched        write   src/lib/format.ts
untouched        write   src/lib/host.ts
untouched        write   src/lib/insight.ts
untouched        write   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
added            write   src/lib/rank.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/lib/sort.ts
untouched        leave   src/logic/after-start.ts
untouched        leave   src/logic/derivations.ts
untouched        leave   src/logic/summarise.ts
untouched        write   src/styles/base.css
untouched        write   src/styles/fonts/Geist-Variable.woff2
untouched        write   src/styles/fonts/GeistMono-Variable.woff2
untouched        leave   src/styles/fonts/LICENSE.txt
untouched        leave   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        write   src/styles/tokens.css
untouched        write   src/views/console-chrome.tsx
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

Finalizing runs `test:t1` — the Tier 1 tests affected by the change, the static checks and the type check — then a production build, the route policy and the size checks. The last two judge the project, not the release: the route policy needs `cacheComponents` and `partialPrefetching` in your Next config, and the size growth needs a `scripts/verify.baseline.json` you recorded (`node scripts/sizes.ts --write-baseline`); without them finalize reports that check `not run` with the reason, and never fails on it. `test:release` is the team's own gate before a release. To check by hand first:

```
pnpm run test:t1
node node_modules/next/dist/bin/next build
node scripts/route-policy.ts
node scripts/sizes.ts
```

## Changelog

The target release's changelog sections above 0.36.0:

```markdown
## [0.39.0] · 2026-11-08

### Added

- **Combobox: one choice from a list of records, found by typing.** A new card, `src/components/ui/combobox`, for options that are records (a person, a ticket), more than about fifteen of them, or loaded from a server: the field filters as the person types, with a loading state and "No match for …" while async options arrive, a WAI-ARIA combobox (`aria-expanded`, `aria-controls`, `aria-activedescendant`) with Select's keyboard behaviour, and `allowCustom` with the caller's `customPattern` for a value that may be typed rather than chosen ("Use “ABC-123”"). It takes Input's frame and sizes and the same `Field` wiring as `Select`; a short fixed list stays a `Select`. The filter and its rank are now one shared function (`src/lib/rank.ts`: a label match first by where it starts, then a match in a description, keywords or hint, then the order given) used by the Command palette too, so both rank the same results the same way. A Combobox needs no new dependency: it is the kit's Popover and Input. The new-ticket dialog's Assignee field uses it over people records, keeping "Nobody"; `skills/zz-meridian/references/customize.md` says when to use each.

### Breaking

- **Three test commands replace `verify` and `gate`.** `pnpm test:t1` runs the Tier 1 tests affected by the changes since the last green run, the static checks and the type check; `pnpm test:t2` adds the affected Tier 2 checks and the browser sweeps; `pnpm test:release` runs every Tier 1 and Tier 2 test once, with the timed browser suites, lint, the type check and a production build. None takes an argument: the command selects the tests. Removed: `pnpm verify`, `pnpm gate`, the `test`, `audit`, `interactions`, `live`, `keyboard` and `vitals` scripts, `test:all`, the `--full`, `--timed`, `--perf`, `--quick`, `--no-vitals`, `--extra` and `--shard` flags, and `scripts/verify.ts`, `scripts/gate.ts` and `cli/scripts/release-check.ts`. `scripts/verify.config.ts` and `scripts/verify.baseline.json` stay. Replace every removed call in your scripts, workflows and shell files: the update's `verify-modes` migration names them, and `docs/testing.md` describes the three commands and what each runs.

### Changed

- **An update's finalize checks the bounded scope, not the release gate, and judges only what the project supplies.** `update --finalize` runs `pnpm test:t1` (the Tier 1 tests affected by the change, the static checks and the type check) and one production build, then the route policy and the size checks when the project supplies what they read. It no longer runs `test:release`: on the 4-CPU release runner that suite alone takes 76 minutes, and a finalize that ran it spent over an hour of every adopter's update and then outlived the release gate's own clock (run 42600180906). `test:release` stays the team's gate before its own release. The route policy is reported `not run` when the project's Next config sets no `cacheComponents` and `partialPrefetching` — an adopted app keeps its own config, and an update never switches its rendering on to get a green finalize — and the size growth only when `scripts/verify.baseline.json` is a baseline the team recorded (`sizes.ts --write-baseline` now stamps `recordedBy`) and differs from the release's, never against the baseline a created project inherited. Neither is ever counted as passed or failed. The consumer smoke records each case's finalize wall time and fails past 90 s for an adopted origin and 240 s for a created one (the latter runs the project's whole shipped Tier 1 set); `docs/testing.md` names both limits and their basis.
- **A browser suite streams its output and names its own failures.** A run announces each suite before it starts, passes its lines through as they arrive, and prints a failed suite's own `FAIL route · control · reason` lines, so a stall or a red names its subject instead of leaving a silent log.
- **A link that never answers ends within a hang guard, not a budget.** The presses follow every link with a 60 s hang guard, far beyond any real answer: a link that accepts and never answers is a named failure, and how fast a page answers is judged only by the timed suites.

- **A live-data case judges arrival, not speed.** Every case in `scripts/live.ts` now waits up to a fixed 30 s for its change — the phone readiness patience, never a budget — and fails only when the change never arrives; the milliseconds it took are recorded in `out/perf-record.json` as Tier 2 values (`live.two-tabs`, `live.visibility`, `live.offline`, `live.burst`, `live.suppressed`, `live.restart-before`, `live.restart-gone`, `live.restart-after`) and compared with the release before, with the old 2 s and 5 s bounds as their seed. A case that shows its change late is a `warn` with its number, not a red. Run 42774379818's consumer failed the restart case at 5 s; that red was not this case's latency but the two-server bug fixed below, and the 2 s and 5 s bounds stay the latency lines they were. The wait runs inside one DevTools command, so that call asks for a 35 s guard while the transport's own default stays 30 s: the deep fixture that plants a hang still ends by it, and the stalled-command known issue below is unchanged.

- **`pnpm test:t1` lints the source files a change touches, with the same eslint `test:release` runs over the whole repository.** A lint error could reach master through a run that checked types but never linted; documents and generated output are left out of the selection (`lintTargets` in `scripts/lib/lint.ts`).

- **A red is Tier 1; every Tier 2 value is measured, reported and recorded.** The checks that say whether a thing works — the tests, types, lint, the build, the route policy, the presses and keyboard walks, the navigation as function (a link that does not work, a route that never becomes ready within its fixed patience, a wrong result), the accessibility audit, the consumer path and Postgres — fail the run, and every stage still runs so one red cannot hide another. The values that say how well it works — LCP, INP, CLS, dropped frames, the navigation and size budgets, the 20-sample p95 — are recorded per sample in `out/perf-record.json`, printed as one table against the release before, and never fail a run or a release; the gates attach the record to the GitHub Release, and `scripts/perf-history.json` carries the last five releases for the next comparison. A timing is flagged at +25% and at least +10 ms, an LCP-scale value at +25% and at least 0.1 s, CLS at +0.05, a size at +5%, and once three releases are recorded the line comes from their spread (mean ± 2 sd, floored at 5% of the mean). `pnpm test:t2` also runs the consumer smoke for a change under `cli/` or the update flow (`--adopt --update --verify`) or under `scripts/` (`--adopt --verify`), with CI's flags, and `pnpm test:release` warns up front when the local Node major is not CI's 22, naming what that leaves unjudged.

### Fixed

- **A server restart in the live check ends the old server's process, not only its port.** `scripts/live.ts` waited for the restarted server's port to stop answering and took that for the process being gone. A graceful `next start` stop closes the port and then waits for its open connections, and a tab's keep-alive sockets are open connections: under load the old process outlived its port by 5 s and more (8 of 12 reproduction runs), so the new process served the port while the old one kept answering one tab from its own in-memory store. That is why run 42774379818's consumer and run 42795390186's gates failed the restart case at 5 s and at the 30 s patience: for the same URL, the writing tab's server answered 50199 bytes with the row while the other tab's answered 48555 without it. It is a check fix, not a product one — a draining server answering its open connections is correct, and a real product reads a database rather than a per-process store. The check now kills the group after the port closes and waits until it is gone, and a restart failure names, per tab, what each refresh was answered with (status, and whether the body held the awaited name). It failed 3 of 12 runs under load before and passes 12 of 12 after.
- **An adopted project whose Next config lacks `cacheComponents` and `partialPrefetching` is told on every update, and its finalize reads its build again.** `adopt` keeps the team's own `next.config.ts`, so a project adopted at 0.38.0 or later can lack the two flags the 0.5.0 migration asks for. Without them the build writes no `renderingMode` into its prerender manifest, and the route policy that finalize now runs read every route as dynamic: an adopted 0.38.0 project updated to 0.39.0 failed finalize with `dynamic route /`, five of five, though the build itself printed each route static (run 42600180906). `cache-components-config` is now a recurring migration: every upgrade at or after 0.5.0 reports it while the flags are missing, and `MERGE.md` names the config; with the flags added, the same build reads `1 static, 4 partial, 0 dynamic`. A project that keeps its own config is not failed for it: finalize reports the route policy `not run` with that reason. A project created with any 0.38.0 or later release already has them and is not asked again.
- **A period switch no longer rebuilds a chart of fifty columns one element at a time.** Past thirty columns a plain Column chart draws its bars as one path per fill inside an inline SVG — the same slots, shares, 4px rounded tops, 2px floor and gap rule — with one overlay mapping the pointer's x to a column, the keyboard and the announcement reading the same active column, and the screen-reader table unchanged. The form it replaces committed about three hundred layout objects in the frame a period switch lands in: on `/` that frame measured 57.8 ms at the phone profile (script 22.7, style 16.7, layout 11.4, paint 11.0) and is now under 25 ms, with no long animation frame at all; at 1440 and 390 in both themes 0.21% of pixels differ from the old drawing, all at the bars' edges. A stacked chart past thirty columns still draws a column of its own — one drawing path for both forms is the follow-up.
- **The reporting-period control measures its options once, not on every change.** It re-created its ResizeObserver on every selection, and delivering the first observation of an element the page had just laid out laid the whole page out again inside the tap's own task. Measured on one period tap at the phone profile: the forced style and layout inside the commit 27.9 ms → 0, observer deliveries and geometry reads inside the tap 4 and 2 → none, and the tap's long frame 57.8 ms (script 51.2) → 54.4 ms (script 17.2).
- **The size checks run again, and every page's HTML is measured.** `scripts/sizes.ts` measures first-load JS from the build's stats and each page's gzipped HTML from the app serving that build. `test:release` ran it with no address, so the HTML line was `not run` in every release, locally and in CI, and `test:t2` did not run it at all. The browser suites now run it once against the app they start, after the build and before any page is walked, and a FAIL fails the run; a warning that the growth was not judged is listed as not run, never as a pass. The baseline in `scripts/verify.baseline.json` records the Node major its HTML was built with (`html.node`): gzip frames a page's inline flight stream differently on each major, so the same `/members` page compresses to 22.9 KiB built by Node 22 and 18.3 KiB built by Node 26 while its bytes differ by 0.3%, and growth is judged only under the recorded major — under another, or with no field, the line is a warning that the growth was not judged. The first baseline of this release was recorded on Node 26; the release gate, which builds on Node 22, caught it with 11 of 21 pages 26–44% over. Re-recorded on Node 22, every page lands within 0.05% of the runner's own figures, `/system` is +1.2% over its 2026-10-27 figure there (the +7.7% seen first was Node 26's framing, not growth), and every absolute cap held. First-load is unchanged: its figures are byte-identical across the two majors.

- **An adopted project's own browser sweeps judge what they can and report the rest, instead of failing routes the template's config does not name.** A project adopted at 0.39.0 inherits `scripts/verify.config.ts` (managed), whose navigation checks name the template's routes; the default walk runs over the project's own rail routes, found no check for either, and threw `never-ready: the rail has no other route to start from` for every route and device, while the phone-closed prefetch cap (0 KiB, the template's promise because its rail is in a drawer) failed a page whose own links prefetch 2.4 KiB — so a project adopted from 0.39.0 failed its own `pnpm test:t2` as made (weekly consumer, run 42659606501). A route with no navigation check still runs its journey when a start exists, with its data readiness and interaction reported not-configured and the reason; with no start it is a red when the project configures any check at all, and is otherwise judged by loading it directly — it renders, draws no error state and raises no console error — with the same not-configured report. The phone-closed prefetch cap is judged only where the rail is in a drawer on a phone and reported not-configured otherwise. The size checks follow finalize's rule: a baseline copied from the release is not the project's own promise, so `sizes: first-load` and `sizes: html` are reported not run with the reason — `node scripts/sizes.ts --write-baseline --base <url>` records a baseline the project owns — rather than judged against figures that are not its; on a machine of another Node major the inherited baseline also held the last-green marker forever. The 20-sample protocol and the route policy follow the same rule: routes with no navigation check are not sampled and a build that writes no `renderingMode` (the config sets neither flag) is reported not run with the reason, each on its own run, never as a pass. Neither is counted as passed: the suite exits 2, the report prints each as not run with its reason, and — because a rerun can never change a project's declared configuration — they do not hold the last-green marker (evidence merely missing, such as a Chrome or a service URL, still does). The template still needs a check for every rail route — `tests/cli-navigation-coverage.test.ts` fails when one is missing — so a new page cannot ship unchecked here.
- **A press that writes a file is an answer.** The presses walk counted a DOM change, a new address, a new tab and a file chooser, but not a download: a real Export that saves a file changes nothing in the page and was reported dead. A click on a link with `download` — in the page, or made by the control itself — now counts, as the suite's own contract already said. The consumer smoke's fixture keeps an Export that downloads a file (and meets the 44px touch target), so this path runs in every weekly; the deep fixtures keep a control that does nothing as the case that must stay red.

### Known issues

- **The created dashboard's `test:release` failed once in the release's consumer job, and its cause is lost.** Run 42646698631's consumer ended on `FAIL pnpm run test:release passes in the new dashboard` after 2589 s; the same suite on the same code passed in run 42659606501 at 2550 s. The smoke printed only the last 40 lines of the failed run, which held a passing test's stderr and not the verdict. From 0.39.0 the smoke keeps the nested run's whole output and prints its `test:release:` verdict and FAIL lines, so a recurrence will name its case; until then this is flaky, not fixed.

- **On the phone profile the alerts panel still opens in one frame, and closing the drawer recalculates the whole page.** The alerts panel commits its Radix Popover content inside the press: LoAF 70 ms at the vitals suite's throttle (style and layout 66, script 53) for a panel of 4 rows, so what costs is the primitive's machinery, not the content. The drawer's open no longer does: its sheet commits in the press and its rail a frame later, where the two together measured 51–63 ms in one frame and now no long animation frame at all. Closing the drawer is still Radix's modal teardown: restoring the body's `pointer-events` and the `aria-hidden` over the page's siblings recalculates the whole page, 64–77 ms of style at the same throttle with one dropped frame and no script; `modal={false}` measured 4–6 ms, and CSS containment on `main` and the cards did not move it. The vitals walk does not measure the close — its Escape falls outside the recorded window — but a person closing the drawer meets it. All three stay on Radix for 0.39.0: a native `<dialog>` drawer measured worse (LoAF 71 ms; `showModal()` lays the whole page out to make it inert), and replacing the modal machinery deserves its own design and tests. The follow-up after the release is the alerts mount and the modal teardown, measured on the same probe.

- **`pnpm test:t1` can miss a test that reads a folder rather than naming a file.** A changed document or skill file selects the tests that name it; a test that reads a whole folder — `tests/cli-skill-layouts.test.ts` over `skills/zz-meridian/` — names none of its files, so a skill or document edit can pass `test:t1` and fail `test:release` (one did on `b28a8133`). Until the selector runs the whole Tier 1 set for a change no test names, run `pnpm test:release` after changing a document or a skill file.

- **A stalled DevTools command can end a browser suite; the session is not reconnected, and the cause is not named.** Twice on 2026-11-08 a suite ended on `Error: Input.dispatchTouchEvent timed out` — the command timeout in `scripts/lib/chrome.ts` — after a long run under the throttled CPU: the presses on `8471c9f3` (1305.8 s against 1056.2 s on a quieter run, its failing line lost to the runner) and the vitals walk on `275e65f4` (`/system/states/error`, after 18 of 30 pages). Neither repeated: a full presses run passed on the quieter machine, and on `275e65f4` the page passed alone three times and the whole vitals sequence passed 30/30 standalone. A retry that passes is not a cause found, so this is reported as flaky, not cleared. A command whose page deliberately waits longer than 30 s carries its own bound, as the live-data arrival wait does; raising the guard is not the fix for a stalled command. The open work is to find why a command stalls on a live connection — a renderer blocked, or a connection the protocol has stopped answering — and to fail that page by name and carry on instead of ending the suite. The owner decided on 2026-11-08 to release with this open, as a known issue.

## [0.38.0] · 2026-11-07

### Added

- **XY line chart.** A measure read against a number with a unit rather than against time: the share of requests served within each latency (a step line), a quantity available within a distance from a reference price (straight). The x positions are the values themselves, one y-scale serves every series, both axes are labelled in their units, and pointing or stepping with the arrow keys reads the nearest measured x and every series' value there. A point with no value breaks the line and reads "No value"; a stated `domain` holds the y-scale and widens rather than cropping. The same values are in a table under the plot (refs #125).
- **Interval timeline.** A catalogue chart that draws what ran and when on one time axis: each row a series of runs from start to end, told apart by tone and, in every place it is read, by word. A run's length stays proportional — a two-second job beside a two-hour one is a marker at its start, never a widened bar — and an open run reaches the now line. Pointing at a run or stepping through them with the arrow keys reads its name, its times and its length (refs #127).
- **Range strip.** A catalogue chart that draws each row's own range from one value to the other on one shared scale, with both ends marked and one or two reference levels drawn across every row: each endpoint's lowest and median latency against the ceiling. A missing end is drawn open and said in words, never from zero. `domain` holds the scale for charts read side by side and widens rather than clipping, naming the range it drew (refs #126).

### Fixed

- **The press walk no longer reports a control it has just chosen as missing.** A radio or a tab is offered only while it is not already chosen, so the accent and density options a press selected stop being listed — correct behaviour, and it left "indigo was listed but could not be found again" on `/settings` once a stored choice carried over from the previous width. A listed control that is absent on the reload *because it is now chosen* is settled, not dead; anything else absent is still reported.
- **The page audit waits for a focus ring instead of sampling for one.** A focus style is computed after the key event: `outline-width` on a newly focused control reads `0px` in the tick the Tab arrives and `2px` a frame later. The audit read it at once, so every stop on every route at every width was reported as a stop with no ring — 907 issues in a full run, none of them the page's. The walk now polls for the ring across up to six frames before calling a stop unmarked, and the same run reports 0 issues (refs #100).
- **A command-palette result row answers 44px on a phone, and the palette is a sheet there.** Rows were fixed at `h-10` (40px), under the 44px touch target `docs/surfaces.md` asks for, and no audit saw it because the palette is closed on a page. They take `pointer-coarse:h-11`, as the menu's own rows do. Under 640px the palette now rises from the bottom as every other dialog does, rather than floating at 14vh where its list sits under the thumb's reach (refs #138).
- **`cn` knows the shadow scale the theme defines.** The tailwind-merge shadow list named `feature`, which is not a token, and left out `halo`, which is: `cn('shadow-halo', 'shadow-card')` kept both, so a card's shadow never replaced the glow it was raised from. The list now names the seven shadows `src/styles/theme.css` defines.
- **A check reports every direct query on a line.** `noDirectQuery` read only the first `.query(` per line, so a second direct read moved beside the first was never reported.
- **Shipped tests follow a project that replaced the sample.** Twelve shipped test files imported the template's sample modules at the top, so a product that replaced the sample with its own data failed those files outright — every case in them, including the ones about the product's own subjects — on a missing module rather than on a rule it broke. Each file now decides once whether the sample is present (`tests/sample-present.ts`) and skips only the cases that read it, keeping the rest running; the sample's modules are loaded lazily, so a skipped suite never reads them at load. This is the guard for the sample's own figures, not a way to keep a broken test green (refs #131).
- **A Trend chart can shade a period a fact names.** `spans` (`{ from, to, label }[]`) draws a full-height wash behind the series from a period's first date to its last — the minutes p95 stayed over its ceiling, or an incident's run — so a chart shows *when* a condition held and not only where the line was. The caption and the key name each span, the readout says which span a pointed point stands in, and a period still open at an edge of the plot reaches that edge. It is not a second band: a band is a level, a span is a period (refs #124).
- **A Sparkline can be read point by point.** An optional `readout` (`{ label, format? }`) makes the line one Tab stop whose pointer or arrow keys name the day and the value under that point, as the Trend chart's readout does; a point with no value reads "No data". Without it the sparkline stays exactly the unlabelled, non-interactive shape it was, which is right beside a figure that already carries the numbers. This is for the view whose only series is a sparkline, where every other chart reads point by point (refs #128).
- **Alerts of different kinds are grouped, each under its own heading and count.** An optional `group` on an Alert ("Incidents", "Verifications") makes the panel draw one section per kind, in the order the kinds first appear, each with its own unread count; alerts without a group are listed as before. A failing verification no longer reads with the same weight as an open incident. The sample's `readAlerts` labels its four kinds: Incidents, Billing, Verifications and Tickets (refs #123).
- **A chart's own encodings carry a key a reader can see.** A Column chart's accented or ringed column now names what makes it the card's subject under the plot ("Accented: the day of the incident"), and a Trend chart's marked days and running stretch name themselves in the legend ("Above the ceiling", "Today so far"). Before, the meaning lived in the table's caption, which only a screen reader reads, and in a pointer title. A single-series chart with marks or a running point now draws the legend row, since the key stands in it (refs #129).
- **A navigation count badge says what it counts.** A rail badge was a bare number with no meaning of its own: clipped from its row or read on its own, "3" said nothing about which destination it belonged to. Each badge now carries an accessible name and a title composed from its destination and count, "API keys: 3 new" (refs #130).
- **The size summary reports growth and the cap as separate verdicts.** `firstLoadProblems` and `htmlGrowthProblems` now return `overCap` and `overAllowance` beside their problems, and both the first-load and HTML lines print `growth within/over N%` and `cap held/exceeded` independently. A route over its absolute cap could previously be summarised as "within its allowance", or a growth failure read as a cap failure (refs #132).
- **Status marks that stand alone say their state in words.** A Metric tile's finding dot and a Shell tools alert row's dot carried their tone in colour only: a screen reader got nothing, and the two patterns worded the same tone differently. Both now name it from one map, `TONE_WORD` on Status dot ("For information", "Went well", "Needs attention", "Failed"), which the Activity feed's system lines share; a finding that points at a day carries the word in its button name too (refs #133).
- **A Trend chart can name the dates that carry an x-axis label.** `tickAt` (`(date, index) => boolean`) makes an hour of minutes read its quarter hours (09:00 · 09:15 · 09:30 · 09:45 · 10:00) and a year of days its month starts, where the default counted back from the last date and landed on 09:04 and 09:11. The width rule still thins the named dates so they never collide, and the readout and the table keep every date. Without `tickAt` the behaviour is unchanged (refs #135).
- **A Column chart can hold its scale to a stated range.** `domain` on ColumnChart (plain, stacked and grouped) does what it does on TrendChart: with every value inside the range the levels end at both ends, so charts read side by side share their levels and compare by height. A value outside it widens the scale rather than being cropped, and the chart says which range it drew (refs #136).
- **A phone card keeps every fact its columns declare.** DataTable capped the card at three facts and dropped the rest silently, so a table whose four measures are read together lost one on a phone. Every column declared `fact` now reaches the card; a table that should carry fewer marks the column `hidden` (refs #137).
- **A disabled or busy Button renders in a server component.** A server-rendered `<Button disabled>` or `<Button busy>` no longer hands React an injected press handler, which made Next fail the whole view ("Event handlers cannot be passed to Client Component props", React error #441). The press is dropped with `disabled` on a native button and with `pointer-events-none` on an `asChild` child, and the injected handler appears only where a function may exist: on the client, or beside a handler the caller passed. Refs #134.
- **Alias resolution no longer imports the compiler package.** The checks and CLI share one Node-only JSONC reader through the existing generated-companion pipeline; BOMs, comments and trailing commas remain supported, while incomplete comments and tokens split by comments are refused. This removes a compiler-package dependency introduced during maintenance.
- **Consumer smoke is classified as a performance check.** Its update-all finalize comparison judges a 30-second overhead budget, so the documented protocol now requires a quiet machine instead of allowing competing builds to invalidate that measurement. This includes the release case; its former quiet-machine exception is removed. The budget and test remain unchanged.
- **Unavailable searches preserve their query.** Disabled and read-only inputs no longer offer an active clear button; Escape preserves a read-only query, and a disabled search leaves its global shortcut alone.
- **Engineering's model figures use 30 complete calendar days.** Gaps in recorded usage no longer pull older measurements into the current month; a model with only older traffic keeps zero requests and unmeasured latency.
- **Committed key writes survive cache-refresh failures.** Creating a key still returns its one-time secret, and revocation stays successful, with a visible refresh warning rather than a false failure that invites another write. Precommit refusals still fail normally.
- **Customer query figures agree with the page after a departure.** Revenue, requests and tokens exclude departed customer records just as the customer count does, even if those records retain nonzero values. The query runner now retains numeric measures' own conditions and withholds a measure whose conditions read hidden fields; the shared source corrects Customers, Home and Revenue answers together.
- **Checks resolve live JSONC aliases against their base URL.** Commented-out mappings no longer redirect the import checks, and a configured `baseUrl` is included instead of reporting valid imports as missing.
- **Unmounted embeds restore the document appearance.** Host theme, display mode, platform, CSS variables and safe-area insets no longer leak into the screen that replaces an embed; prior values and CSS priorities are restored.
- **Aggregate date buckets reject impossible calendar days.** Day, week, month and weekday groups, and date windows, share the calendar validation used by display labels; malformed dates neither invent a group nor crash a week query.
- **Failed live-stream setup releases subscriptions.** An adapter failure while subscribing or reading revisions cleans up earlier listeners and the abort handler; a synchronous abort during subscription stops setup without writing to a closed stream.
- **All-row reads refuse inconsistent pages.** Changed totals or revisions, duplicate collection keys and extra rows can no longer masquerade as a complete result merely because enough rows were returned.
- **Updates preserve edited text that resembles import syntax.** Import equivalence now considers only an unambiguous leading static declaration block; rendered strings, comments and other uncertain syntax remain edits to merge rather than being silently replaced. This conservative boundary is provisional.
- **Array collection writes reject before changing stored rows.** Batch derivations and response copying are staged before commit, so a later derivation failure or an uncloneable result cannot leave partial writes, a false revision or a change hint behind.
- **Disposed host bridges settle their pending calls.** Unmounting rejects outstanding requests, clears their timers and stops initialization retries; later requests are refused without sending, and synchronous transport errors become promise rejections.
- **Live data survives a synchronous stream refusal.** An EventSource construction failure follows the existing retry and polling fallback instead of throwing out of the provider; later retries can restore the stream, and disposal still stops the polling.
- **Atomic CLI writes cannot follow a planted temporary-file link.** Update and brand now create a private sibling directory for each replacement, preserve the requested mode, and clean up temporary output on failure without altering the original destination.
- **Calendar labels preserve the date they were given.** Impossible dates such as February 30 remain visible as invalid input instead of rolling into March, and valid years below 100 no longer acquire 1900 years.
- **Rebranding reports an incomplete rollback honestly.** When restoring one file fails after a write error, branding continues restoring the others and names the paths requiring recovery instead of claiming nothing changed.
- **Adoption checks both skill destinations before changing the project.** A skill file or folder linked elsewhere, including a dangling link, is refused before copying or branding files. Previously adoption could modify the project and then fail when the skill installer rejected the same link.

### Known issues

These are reds from the weekly run of 2026-11-02 (commit b7c7a5fa). Under decision 0010 they do not hold a release.

- **The after-live journey to `/requests` has no start** (#139). `scripts/perf.ts` reports that no other rail route registers live data to start from. This is the first weekly run since the pages moved into workspaces. The fix is in the check, and the issue says how to tell which of two causes it is.
- **`/` can drop one frame when the navigation opens on the weekly runner** (#140). The longest frame was 59 ms against the 50 ms floor: 32 ms of it is script run by the click. It is fixed in the page, not by moving the floor.

## [0.37.1] · 2026-11-01

### Fixed

- **The rail adds no first-load script to every route** (#122). A branch's toggle drew a `ChevronRight` of its own, and in an adopted project's module graph that one icon split the menu icons into a first-load chunk of their own: one more request on every route, about 0.3 s more LCP on a page that paints its text on hydration. The toggle is now the `ChevronDown` the rail already draws, turned a quarter while the branch is closed.

## [0.37.0] · 2026-11-01

### Breaking

- **Uncontrolled Proposal requires `onApprove`.** Controlled state still permits an external approval handler; untyped callers without the required handler enter Failed rather than claiming Applied.
- **Partial sample data is explicit.** `HomeData.totals` can be null. `RevenueData.history` now owns historical `count` and `windows`; `days.windows` is removed. Guard the nullable parts independently rather than substituting zero or requiring unrelated reads.
- **The palette's opener has a module of its own.** `openCommand` and `usePaletteKey` moved to `@/components/patterns/command-palette/open`. The Command palette is now a chunk of its own, loaded with `next/dynamic` once the page has hydrated, and its file no longer exports them. Import them from the new path; `update` names each file that still imports them from the palette (`open-command-moved`).
- **Mutation tools return an applied outcome envelope.** Successful create, update and remove outputs are now `{ status: 'applied', result, warning? }`, not raw records or removal values. Read the visible data from `result`; domain fields cannot impersonate protocol metadata. A postcommit cache failure remains Applied with a warning, never an invitation to repeat the mutation.

### Fixed

- **Interaction checks observe before pressing.** A delayed observer timer can no longer lose an immediate response and report a working control as dead; genuinely unresponsive controls still fail.

- **Committed replays stay successful when cache refresh fails.** The action returns the new request with a refresh warning, shown with its Open action, instead of falsely reporting Not replayed and inviting another write.

- **Customization guidance respects data and surface boundaries.** Server pages or logic read the data seam and pass values into views; views import only types or the documented vocabulary. Product summaries belong to logic, shared formatters to lib, and fullscreen customer controls open through the host.

- **Fullscreen Requests opens customers through the host.** Activating a known customer no longer navigates the embed frame or also opens its request; console customer links keep their destination.

- **Zero-latency request context stays factual.** A trace with no elapsed time no longer invents a 1ms total or attributes that time to Gateway.

- **Password sign-in starts with an active identity.** An inactive first persona no longer makes the default submission fail when another persona remains active; a refused submission still preserves the person's choice.
- **Verification proves every data destination local before pressing controls.** PostgreSQL authority, query overrides, environment defaults, services and every failover host are considered; uninspected destinations fail closed. Other drivers do not inherit libpq query semantics, malformed loopback lookalikes are refused, and owned containers use explicit loopback forwards.
- **Accent names cannot escape the preset directory.** Branding refuses paths and unsafe filename components before any configuration writes.
- **Copy feedback belongs to its value and latest attempt.** Replacing a value or privacy mode clears stale feedback; late clipboard completion cannot reveal or mark a different secret. Every successful press receives its full feedback interval, and a later refusal selects the current value again.
- **Chart cursors reconcile address and date-frame changes.** A new address day takes over once, an unchanged address preserves local pointing, shifted dates retain their identity, and removed dates clear the cursor.
- **Segmented markers follow same-length reorders.** The existing observer remeasures the selected option after its order changes without forcing layout in an effect.
- **Host context retries belong to the current bridge.** Disposed initialization and retry completions cannot update a replacement host connection or send stale model context.
- **System-light embeds retain the host token bridge.** Generated system-theme rules no longer overwrite host-provided variables with unbridged light values.
- **Fullscreen embed records open in the host once.** Table rows support the host navigation callback for pointer and keyboard activation without navigating the iframe; console record links keep their existing behavior.
- **Unread export data is not an empty export.** Home, Revenue and Usage preserve failed-read provenance. Export reports unavailable data rather than a successful empty read, and a genuinely empty export no longer suggests clearing nonexistent filters.
- **New tickets explain missing services.** Authorized users with no selectable services receive recovery guidance and Refresh from either entry point instead of an impossible creation form.
- **Migrations and direct-query guards cover both app roots.** Supported `app/` and `src/app/` projects receive the same route, layout, page-spec, assistant and authorized-reader review.
- **Changed managed writes block update finalization.** Readiness checks the bytes applied by automatic writes and removals before validation or baseline advancement; intentionally team-preserved shared files remain editable.
- **CLI commands refuse surplus positional arguments before mutation.** An ignored extra folder can no longer silently apply a command to the current project.
- **Payloads exclude nested environment files.** Tracked `.env*` files are excluded at every depth while exact `.env.example` templates remain distributable.
- **Adoption raises insufficient supported dependency floors.** Required minor and patch floors are compared as well as majors, preserving the existing dependency section, newer requirements and custom sources.
- **Adoption reports both type stages truthfully.** A failed route-type generation cannot be described as passing merely because `tsc` succeeds; adoption retains its documented best-effort exit behavior.
- **The browser audit preserves requested query values.** Repeated values and their order are checked, not merely the presence of each query key.
- **Keyboard walks must close in both directions.** Exhausting a walk or repeating a later stop is a failure rather than evidence that Tab returned to its first control.
- **Navigation mappings cannot silently duplicate a route.** Duplicate checks fail even when their route is outside the selected smoke subset.
- **Every screenshot press option requires a control name.** Missing values are refused before browser launch instead of consuming another option.
- **Workspace journeys distinguish declared missing request routes.** A legitimate record whose id contains `missing` remains a real detail destination.
- **Assistant page identity stays in an escaped data boundary.** Browser-supplied titles and addresses cannot close their own wrapper or introduce trusted guidance.
- **Committed assistant mutations stay consumed after invalidation failure.** Authorization and mutation define the once-only commit point; an in-flight duplicate is reported as still in progress, never already applied. Stale-cache warnings preserve Applied, provenance is still attempted, and replay cannot duplicate the write.
- **Adapter guidance specifies pagination before all-row traversal.** Queries apply filtering and stable ordering before offset and limit, with total counted before pagination.
- **MCP examples filter views for their own caller.** Every declared grant is checked against the explicitly resolved MCP scope rather than an ambient console session.
- **All-row reads cross the public offset ceiling safely.** Authorization and normalization happen once; trusted internal pages retain filters and order beyond 100,000 rows without widening public query limits.
- **Cache guidance distinguishes identity from invalidation.** Cached results include the complete authorization scope and normalized query; tenant/collection tags are not the cache identity.
- **Workspace actions refuse malformed name values.** Non-string input is a typed refusal before persistence or invalidation, not a coerced workspace name.
- **Sample trace phases fit the request latency.** Small and zero-duration requests retain nonnegative contiguous phases whose total matches the actual duration.
- **Live subscription changes invalidate old resynchronizations.** A late success, network error or authorization failure from the previous collection union cannot settle the new stream.
- **The dashboard fallback accepts actual framework error values.** Null, primitive and malformed-digest errors retain a usable recovery control without exposing thrown details or claiming an unobserved cause or mutation outcome.
- **Architecture guards resolve real module boundaries.** Explicit JavaScript specifiers follow TypeScript substitution order, and type-only imports remain distinct from product runtime dependencies.
- **Server-component checks parse directive prologues.** Comments and byte-order marks no longer hide a real `use client` directive.
- **Timed-documentation negation is clause-local.** Wrapped negative claims remain valid without hiding a neighboring false affirmative claim.
- **Checker fixtures own their temporary resources.** Readiness waits buffer split output, reject failed children and await shutdown; temporary exploration roots are removed after each case.
- **Progress requires a finite positive whole.** An infinite denominator is an unknown share, not a zero-percent measurement or invalid ARIA range.
- **Missing mutation responses remain unconfirmed.** Member, role, invitation, workspace-save and replay feedback no longer asserts that a rejected request wrote nothing. Drafts and existing recovery behavior remain; users are told to inspect current records before retrying.
- **Adoption preserves punctuation in TypeScript configuration strings.** Removing JSONC trailing commas also removed commas before `]` or `}` inside string keys and values, changing aliases, paths and plugin options. Only commas outside strings are removed.
- **Derived answers stay within the caller's full access scope.** Cached and in-flight builds are partitioned by tenant, subject and authorization identity. Every reader checks its own source authorization before joining a build; a concurrent denial cannot inherit another reader's permission.
- **Untrusted assistant context cannot reconstruct wrapper tags.** Page text, view context and product briefs escape markup linearly instead of splicing tag fragments back together. This preserves their data boundary; it does not replace the assistant's authorization and proposal rules.
- **Later upgrades recheck team-owned sample contracts.** The sample-with-its-tests migration runs on every forward upgrade where applicable, including projects created after its introduction. Adapt an intentional implementation; do not remove a meaningful failing regression to complete an update.
- **Skill installation preserves existing team instructions.** Both destination trees are checked before either is written. Identical installs remain repeatable; differing files or unsafe paths are refused with recovery guidance.
- **Branding rejects invalid time zones before changing configuration.** Create and brand accept the same IANA time zones that the running application can format.
- **Avatar images recover when their source changes.** A failed image no longer permanently hides a later valid source.
- **Disabled and busy Buttons block child activation.** The shared capture guard also covers `asChild` links and nested handlers without taking a busy control out of the keyboard order. Variant and size roles compile into shared CSS rather than repeating their utilities in every instance and client chunk.
- **Copied cURL requests preserve the captured request.** JSON bodies retain precision, duplicate keys and whitespace; leading `@` is literal data, and an empty body is distinct from no body. Methods, URLs and bodies are shell-quoted so captured values cannot execute shell expressions.
- **Live polling refuses overflowing or nonfinite intervals.** Invalid values cannot wrap into a near-continuous timer; valid intervals retain the one-second minimum.
- **`readAll` consistently ignores pagination.** Both limit and offset are ignored while filters and ordering are preserved, preventing duplicated or omitted rows.
- **Inline Now reports unread incidents without discarding services.** Healthy service rows no longer imply that an unread incident source was checked.
- **Sign-in retains a persona that became unavailable.** The refusal stays attached to the selected person instead of silently switching to the first option.
- **Home omits undefined percentage growth.** A fully counted zero-request baseline uses the existing neutral year context instead of a percentage claim with no denominator.
- **The customer journey exercises declared missing routes.** Unknown-customer coverage no longer disappears because it searched only known detail routes.
- **Browser downloads stay in the disposable profile.** The Chrome protocol policy supports both Chrome and chrome-headless-shell without relying on profile preferences alone.
- **Current replacement guides retain shared contracts and policy.** Removing the Members workspace does not remove the grants still used by authorization; replacing the memory adapter does not delete collection contracts still imported elsewhere.
- **CLI help lists the supported theme option.** `--theme dark|light` is discoverable alongside other branding options.
- **Repeated branding preserves quoted names.** Apostrophes are serialized as data, and later changes can still find escaped configuration values without corrupting an unchanged person's name.
- **Skill installation refuses an incomplete package.** A missing `SKILL.md` is reported before either skill destination is written, instead of reporting a successful empty installation.
- **Update reports preserve literal metadata.** Failure and coverage values containing replacement-string sequences such as `$&` are recorded unchanged during finalize and resume.
- **Create prints a runnable installation retry.** Package-manager arguments are separated by spaces rather than commas when installation fails.
- **Search keeps its Escape behavior with a caller's key handler.** Enter and other custom keyboard actions compose with clearing and second-Escape blur; a caller can deliberately consume a key with `preventDefault()`.
- **Composition Escape does not erase search.** Search inputs and the Atlas shelf leave Escape to an active IME composition; ordinary clear and blur behavior remains.
- **Unread Home totals stay unknown.** A failed period read no longer manufactures zero sales, compute, costs or a zero-valued record; independently readable year and customer facts remain.
- **Revenue keeps independent reads independent.** Current figures survive unread history, and historical windows survive an unread current period. Missing comparison evidence is not described as an observed absence.
- **Ambient shell identity cannot replace a page's refusal.** Optional live and assistant scope resolve to absence when identity cannot be read; the page still owns its authentication and permission response.
- **Sign-in explains an unavailable roster.** Empty or entirely inactive personas produce a named unavailable state instead of a password/persona form that cannot succeed.
- **Embed theme follows its host.** Device preferences and storage events no longer overwrite initial host context. An unspecified host theme stays unset and follows later system-scheme changes through CSS.
- **Pending previews stay visible and named.** Card and standalone preview stages reuse one busy skeleton while code or route parameters arrive.
- **Atlas entries stream URL-specific content behind a real boundary.** The shared shelf remains available during navigation; parameter reads no longer block the reusable app shell. Validation stays enabled.
- **Appearance accents work through menu navigation.** Every accent is a labeled menu radio item reached by arrows, Home/End and typeahead, not a plain button excluded from roving focus. The static specimen matches.
- **Long menus fit short screens.** Their own available-height bound and scrolling keep first and last focused choices visible.
- **The Atlas contents drawer covers sticky chrome.** Its modal content and scrim use the overlay layer instead of the rail layer, so the first keyboard target is no longer covered by the mobile header.
- **A closed Rail does not reference absent content.** Its trigger only carries `aria-controls` while the controlled drawer is mounted.
- **Empty captured bodies are not absent bodies.** Request detail names the zero-byte capture and keeps its exact Copy action; an absent capture makes no claim about what a method can carry.
- **Branding rejects missing option values before writing.** A following known flag is not consumed as a product name, and incomplete valued flags cannot partially apply earlier options.
- **An empty Atlas search says so.** A quiet status distinguishes no matching entries from a blank or still-loading shelf and disappears when the query is cleared.

- **A pager offers a page-size menu only when there is a choice** (#109). `Pagination` drew a "10 per page" menu that listed one size; it now needs two sizes or more.
- **One exported row reads in the singular** (#112). `ExportButton` takes `one`, the singular noun, so a single row toasts "Exported 1 day" rather than "Exported 1 days"; the template's exports pass it.
- **CSV files open in Excel on Windows** (#113). `downloadFile` and the server export start a CSV with a byte order mark (`CSV_BOM` in `src/lib/csv.ts`), so non-ASCII text is read as UTF-8 rather than in the system code page; `toCsv` still returns the rows without one.
- **A row of tiles never leaves a hole** (#111). One tile spans the row; five or more run in rows of two, then three, and the last tile spans what its row leaves empty, where the row clamped to two to four columns.
- **An activity line breaks inside a word wider than itself** (#121). An actor named by an email address no longer spills its line at 320px.
- **Chrome is attached once it has a page** (#110). The debugging port can answer with an empty target list before the first page exists; the checks keep polling until a page is listed instead of failing on `webSocketDebuggerUrl` of undefined.
- **The live check reports a members page that did not open** (#118). A slow first open is a FAIL line of its own with every case marked not run and why, instead of an unhandled rejection with no case lines.
- **A failed audit under verify shows its FAIL blocks** (#120). The lines kept beneath a failed suite leave out the audit's design-metrics table, which on a large product filled all sixty of them.
- **`contrast.ts --all` says ok only for a chart palette that passed** (#117).
- **Generated and managed comments describe the project they are in** (#115, #119). The `tokens.css` header names the layers by folder and lists the theme, accent and density values the project's own `tokens/` declares; `navigate.ts`, `AskAbout` and `measure` say what the code does.
- **The browser checks share one deep query and one not-found address** (#114). The journey uses `deepQueryAll` from `scripts/lib/deep.ts` rather than its own copy, and `NOT_FOUND_PROBE` lives in `scripts/lib/routes.ts`, beside `discover()`, which adds it.
- **`update` names four more changes it cannot make.** `env-reset-before-each` (0.29.0) names a test of the team's that sets the environment in `beforeAll`, which `tests/setup.ts` resets before the first test (#106); `computed-series-slot` (0.32.0) names a chart `color` computed by arithmetic and not typed `SeriesSlot` (#104); `proposal-approve-required` (0.37.0) names an uncontrolled `<Proposal>` without `onApprove`; and `nav-item-fields` now reads a `NavItem` type the configuration does not export (#103). Each was a type or test failure at `--finalize` with no line saying why.
- **A product's own rule can see what an update brings** (#105). `effectiveManifest()` in `scripts/lib/effective-manifest.ts` answers with the open update session's target manifest, and with `.meridian/manifest.json` otherwise, so a rule in `scripts/check.local.ts` that asks whether a path is Meridian's no longer fails every file the update added.

### Changed

- **The Command palette is in no page's first load.** It was in every route's, and a project fresh from `create` measured `/engineering` 48 bytes over the 830 KiB first-load cap. `ConsolePalette` now loads it with `next/dynamic` after hydration, and a press that lands before it has mounted opens it as soon as it does: about 17 KB off every route's first load (`/engineering` about 813 KiB in a created project).
- **The last of five or more tiles is spanned by CSS** (#111): `base.css` spans it by the count's remainder, where class tables did in the shell's JavaScript.
- **The faces are cut to the Latin scripts** (#116). `Geist-Variable.woff2` and `GeistMono-Variable.woff2` hold Latin and Latin Extended plus the arrows, minus sign and command key the product draws, with the weight axis and every OpenType feature kept: about 43 KB each, where the whole faces were about 70 KB, which on the phone profile cost about 0.22 s of LCP on text pages. Another script falls back to the system face. The cut is `pyftsubset <face> --layout-features='*' --flavor=woff2 --unicodes=U+0000-00FF,U+0100-02FF,U+0304,U+0308,U+0329,U+1E00-1EFF,U+2000-206F,U+20A0-20C0,U+2113,U+2122,U+2190-2193,U+21B5,U+2212,U+2215,U+2318,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD`.

- **Update-session rules have one authored source.** The payload producer generates the CLI companion from the same source revision as the payload; adopted plain-Node gates and the compiled CLI keep their existing runtime layout.
- **Tests check behavior rather than incidental implementation.** Removed source-text, wording, utility-class, default and copy-only pins; retained meaningful domain, security, accessibility, geometry, architecture and validator checks. Removed mirrored rule-manifest rows, test-local source-site inventories and dispatcher-forwarding assertions; executable checker fixtures and state-transition regressions remain. Current testing and Atlas documentation names what those checks actually establish.
```

