# Update 0.13.0 to 0.14.0

- Source: 0.13.0
- Target: 0.14.0
- Route: adopt
- Session: 20261011T172635819Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.14.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.14.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.14.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### file:scripts/check.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/scripts/check.ts`
- ours: `.meridian/update/0.14.0/ours/scripts/check.ts`
- new: `.meridian/update/0.14.0/new/scripts/check.ts`

Resolution stub:

```json
{
  "id": "file:scripts/check.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/check.ts": "sha256-9784cc6077f4a34c30bf5d28b3b22177aef827851e7871611e5d9632bb8c36b4"
  }
}
```

### file:scripts/keyboard.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/scripts/keyboard.ts`
- ours: `.meridian/update/0.14.0/ours/scripts/keyboard.ts`
- new: `.meridian/update/0.14.0/new/scripts/keyboard.ts`

Resolution stub:

```json
{
  "id": "file:scripts/keyboard.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/keyboard.ts": "sha256-747d7fbaafeffe7e51558f4d1f73d80c0e70656e66e5d6fc1bd2ae2afeb43a34"
  }
}
```

### file:scripts/lib/context-check.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/scripts/lib/context-check.ts`
- ours: `.meridian/update/0.14.0/ours/scripts/lib/context-check.ts`
- new: `.meridian/update/0.14.0/new/scripts/lib/context-check.ts`

Resolution stub:

```json
{
  "id": "file:scripts/lib/context-check.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/lib/context-check.ts": "sha256-a53a45d51cc877cff33d446687dc171591c61e3110ca25b3b1832d57edf4edaf"
  }
}
```

### file:scripts/vitals.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/scripts/vitals.ts`
- ours: `.meridian/update/0.14.0/ours/scripts/vitals.ts`
- new: `.meridian/update/0.14.0/new/scripts/vitals.ts`

Resolution stub:

```json
{
  "id": "file:scripts/vitals.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/vitals.ts": "sha256-ebd41ca44b9ac4031308da8517f8910c154d6a310e722cd0755b71a04c8870fd"
  }
}
```

### file:src/components/base/app-mark/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/base/app-mark/index.tsx`
- ours: `.meridian/update/0.14.0/ours/src/components/base/app-mark/index.tsx`
- new: `.meridian/update/0.14.0/new/src/components/base/app-mark/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/base/app-mark/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/app-mark/index.tsx": "sha256-3a77e1c95de16b69eba388deeeecd1c0720c302dc0d74b68078a0cd59b8e2931"
  }
}
```

### file:src/components/patterns/data-table/use-query-state.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/patterns/data-table/use-query-state.ts`
- ours: `.meridian/update/0.14.0/ours/src/components/patterns/data-table/use-query-state.ts`
- new: `.meridian/update/0.14.0/new/src/components/patterns/data-table/use-query-state.ts`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/data-table/use-query-state.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/data-table/use-query-state.ts": "sha256-3eeb12a269a482287caa7494d17e0837ae927604f6dd767d0237ccc37ada8146"
  }
}
```

### file:src/components/patterns/prose/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/patterns/prose/index.tsx`
- ours: `.meridian/update/0.14.0/ours/src/components/patterns/prose/index.tsx`
- new: `.meridian/update/0.14.0/new/src/components/patterns/prose/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/prose/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/prose/index.tsx": "sha256-3080884c99c4f500cbf70b043477f55c0382c622cb47a26e2ecfda1cc8859f5b"
  }
}
```

### file:src/components/patterns/rail/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/patterns/rail/index.tsx`
- ours: `.meridian/update/0.14.0/ours/src/components/patterns/rail/index.tsx`
- new: `.meridian/update/0.14.0/new/src/components/patterns/rail/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/rail/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/rail/index.tsx": "sha256-e7f37196e80284bb9b21a9b1726990c2f367f397eb9444be5f34053252db5eb6"
  }
}
```

### file:src/components/ui/search-input/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/ui/search-input/index.tsx`
- ours: `.meridian/update/0.14.0/ours/src/components/ui/search-input/index.tsx`
- new: `.meridian/update/0.14.0/new/src/components/ui/search-input/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/search-input/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/search-input/index.tsx": "sha256-384374bc85fbb2cdc141afdd201e95b3f2b8a874891f9561784a3a28b9011cf6"
  }
}
```

### file:src/components/ui/toast/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/components/ui/toast/index.tsx`
- ours: `.meridian/update/0.14.0/ours/src/components/ui/toast/index.tsx`
- new: `.meridian/update/0.14.0/new/src/components/ui/toast/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/toast/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/toast/index.tsx": "sha256-f1c202145ccd230ee172867efcde3956eb36a98513eaff95c1597b980d04146d"
  }
}
```

### file:src/lib/color.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/lib/color.ts`
- ours: `.meridian/update/0.14.0/ours/src/lib/color.ts`
- new: `.meridian/update/0.14.0/new/src/lib/color.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/color.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/color.ts": "sha256-4216e16b90d96dbcf7295aa88cc8b1f264ac44270d0a99a3c89515eade395d18"
  }
}
```

### file:src/lib/format.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/lib/format.ts`
- ours: `.meridian/update/0.14.0/ours/src/lib/format.ts`
- new: `.meridian/update/0.14.0/new/src/lib/format.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/format.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/format.ts": "sha256-92d7b28f7f522f25134fb492aa9ff39cde2211cc5c19a78012cbc4137a901cf6"
  }
}
```

### file:src/lib/period.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/lib/period.ts`
- ours: `.meridian/update/0.14.0/ours/src/lib/period.ts`
- new: `.meridian/update/0.14.0/new/src/lib/period.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/period.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/period.ts": "sha256-cf533250e5f601e122cc1ebb37e14afef4841be9ba59d1183e7b9de773986680"
  }
}
```

### file:src/lib/safe-markdown.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/src/lib/safe-markdown.ts`
- ours: `.meridian/update/0.14.0/ours/src/lib/safe-markdown.ts`
- new: `.meridian/update/0.14.0/new/src/lib/safe-markdown.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/safe-markdown.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/safe-markdown.ts": "sha256-3ffe6bd92781030cd96d15dc7d91eeecfa828dfd220256f5426c4c1d9a0a2f8a"
  }
}
```

### file:tests/setup.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.14.0/base/tests/setup.ts`
- ours: `.meridian/update/0.14.0/ours/tests/setup.ts`
- new: `.meridian/update/0.14.0/new/tests/setup.ts`

Resolution stub:

```json
{
  "id": "file:tests/setup.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "tests/setup.ts": "sha256-7e31a7569524f92926afe3cb9f8361061f0ab5c19353c1c21a4a061c72911a86"
  }
}
```

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
    "package.json": "sha256-bc9c426a0b2cf30a7c963114ddb426a420fcb37a6b53e70575d96b7c18c4177c"
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

- edited/stage: 15
- team-preserved/write: 1
- untouched/leave: 142
- untouched/write: 11

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
untouched        leave   .agents/skills/zz-meridian/references/existing-project.md
untouched        leave   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        leave   .agents/skills/zz-meridian/references/standard.md
untouched        leave   .agents/skills/zz-meridian/references/update.md
untouched        leave   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        leave   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        leave   .claude/skills/zz-meridian/references/cache.md
untouched        write   .claude/skills/zz-meridian/references/customize.md
untouched        leave   .claude/skills/zz-meridian/references/existing-project.md
untouched        leave   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        leave   .claude/skills/zz-meridian/references/standard.md
untouched        leave   .claude/skills/zz-meridian/references/update.md
untouched        leave   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        write   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        leave   scripts/brand.ts
edited           stage   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        leave   scripts/interactions.ts
edited           stage   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
edited           stage   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/sizes.ts
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
untouched        leave   scripts/verify.ts
edited           stage   scripts/vitals.ts
edited           stage   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
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
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/data-table/index.tsx
edited           stage   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        write   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        leave   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/index.tsx
edited           stage   src/components/patterns/prose/index.tsx
edited           stage   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/patterns/status-list/summarise.ts
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        write   src/components/ui/button/index.tsx
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
edited           stage   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        write   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
edited           stage   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        leave   src/lib/collection.ts
edited           stage   src/lib/color.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/format-date.ts
edited           stage   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        leave   src/lib/insight.ts
untouched        leave   src/lib/live.ts
untouched        leave   src/lib/logo.ts
edited           stage   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
edited           stage   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/styles/base.css
untouched        write   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        write   src/styles/tokens.css
untouched        leave   src/views/console-chrome.tsx
edited           stage   tests/setup.ts
untouched        leave   tokens/accent.brand.tokens.json
untouched        leave   tokens/accent.cobalt.tokens.json
untouched        leave   tokens/accent.graphite.tokens.json
untouched        leave   tokens/accent.indigo.tokens.json
untouched        leave   tokens/accent.jade.tokens.json
untouched        write   tokens/core.tokens.json
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

The target release's changelog sections above 0.13.0:

```markdown
## [0.14.0] · 2026-10-11

### Added

- **A form page has a width of its own, and the token layer documents the layout.** `tokens/core.tokens.json` gains `field-width` (64rem: the widest a form's card may be, in rem so the measure grows with the reader's text size) and `form-width` (a form page: its head column, the column gap, a `field-width` card and the page's gutter — written as `calc()` over the parts, so it holds at any root size). `PageFrame` gains `width="form"` and Settings is the page that uses it: the page fills the canvas until the canvas is wider than a form needs, then centres, so the remainder splits evenly instead of leaving the canvas's right side empty — visible on a window wider than about 1470px (with the card capped at 896px, the empty band beside it was about 430px at 1920px and about 1050px at 2560px, measured from the card's right edge to the page's content edge), invisible at 1440px and below. The card's own measure is unchanged (`FormSection`'s `64rem` is now `var(--field-width)`), and a field still never stretches across a wide screen. `LoadingPage` takes the same `width`, and Settings' `loading.tsx` passes it, so the skeleton stands where the page will be instead of moving it when the page arrives. `reading-width`'s description said it was for "forms, documents and settings", which nothing did; it now says what it is — one long document — and the Atlas has a seventh token view, **Layout**, drawing every width role to scale in one place. Additive apart from that description: a product that passes no `width` renders exactly as before.

- **The token layer documents the groups it never showed, and the specs stop contradicting it.** Three of the eight core groups had no view in the Atlas at all, so a reader looking for how high a dialog sits or what the rail's glass does found nothing: `Elevation` now carries **Stacking** (the six `layer-*` tokens in order, drawn) and **Glass** (both blurs, over something moving), and the token layer's own prose is corrected — `motion`'s opening said "four durations" where the file has six plus three loops, `float-in` said it leaves over 120ms where the CSS uses `dur-exit` 140ms (the same claim stood in Popover, Menu, Select and Tooltip), and three cards said the system allows two loops where a Spinner's ring is a third. Nothing a product renders changes: every one of these is a description, a spec or an Atlas view.

### Fixed

- **`audit.ts --atlas` also measures the Atlas's other entries.** The token views, the page specs and the guides live under `[section]/[id]`, so `discover()` skips them as dynamic segments and `--atlas` read only the card registry: a defect in a token view or a guide failed no suite at all. It now reads the entries through the module the Atlas renders from, so a new one is measured without being listed. Measured: 0 issues across the seven entries checked (the token views, two page specs, a guide and the changelog) at five widths in both themes.
- **The Members table fits its frame again, and the assistant walk-through passes every step.** `Joined` dropped a column too late (the table's own 672px, not 896): under it the table measured 759px in a 713px frame, so the audit failed `/members` at two widths in both themes — a table wider than its card is clipped, not scrolled — and with the assistant panel open the actions column sat outside the card, where a real click cannot reach it and the walk-through's row-menu step timed out. Found by `pnpm verify --full` (four audit issues) and by the walk-through, one cause behind both.
- **`scripts/assistant.ts` says when a control has no box.** A control hidden by a container query answers `getBoundingClientRect()` with 0x0, so the harness clicked the page's top-left corner and reported a timeout somewhere else; it now fails with "the control is in the DOM but has no box at 0x0 — hidden at this width?", which is what another session needed twenty minutes to work out.
- **An agent's approved change to a member no longer fails in a built app.** `src/data/member-mutations.ts` invalidated its tags with `updateTag`, which Next allows **only in a Server Action** — so the assistant's route handler and an adopter's MCP server, the two callers the module's own doc names, threw `updateTag can only be called from within a Server Action` the moment a change was applied: the Proposal was approved, the rows never moved, and the app answered with an error. The boundary now invalidates with `updateTag` where it is legal and `revalidateTag` where it is not, so a page action keeps its read-your-writes and an agent's write reaches the page. Found by the assistant walk-through, which timed out waiting for the rows to read Suspended — a suite that had not run since the member boundary landed (`585349a`, after the last full run).
- **A busy button is drawn as working, at the size of its own icon.** It was drawn at the same 45% opacity as one nobody may press, so it read as unavailable while it was working — the spec said only a disabled button greys out, and the code did not agree. It keeps its colour and its shadow now, with the spinner as the answer. The spinner was also always 14px, so a `lg` or `md` button that carries an icon moved by 4px or 2px the moment it went busy — the one case `busy` exists to make steady (Replay on a failed request, for instance). The Button now composes `Spinner` instead of drawing a second ring of its own, and the Spinner's third step is 18px rather than 20px, so its three steps are the icon scale's (14, 16, 18) and one stands in for the other exactly. `Spinner` gains a decorative form (`label={null}`) for the case where the control announces itself — a busy button's accessible name is unchanged, which a check confirmed — and the spec says plainly that a button with no icon gains the slot and widens by it.

- **Specimens and specs were sizing controls from the retired scale, and three page specs quoted the window's breakpoints for a table rule.** Five files still drew controls at 30/36/44 and 26/30/36 where the tokens are 32/38/46 and 28/32/38, and Members, Customers and API keys said their columns drop at 768/1024/1280 — the window's breakpoints — where `hideBelow` reads the table's own 672/896/1152; the four thresholds are now stated once, in the Table card. A suspended persona in the rail's specimen used the disabled ink without saying it was disabled, which the audit measured at 1.38:1 in dark and 2.31:1 in light; it is now a row with `aria-disabled` and the words "Not active", as the product draws one.

### Changed

- **With one workspace or none, the rail's row is the account menu, not a switcher.** A product that passes no `scopes` still opened a menu headed `Workspace` holding a single disabled, checked row — a chevron that promises a choice, opening a list with no choice in it (#20). The row now says `account menu` to a screen reader and carries a plain `ChevronDown` unless more than one scope is passed, and the menu renders no `Show` group and no checked row of its own unless there is something to switch between. A product passing several scopes is unchanged: the `Show` group, the radio items and the switcher glyph are as they were. The card's preview draws both states, and `README.md` states the rule.
```

