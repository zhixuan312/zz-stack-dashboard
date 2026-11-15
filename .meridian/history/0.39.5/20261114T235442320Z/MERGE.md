# Update 0.39.4 to 0.39.5

- Source: 0.39.4
- Target: 0.39.5
- Route: adopt
- Session: 20261114T235442320Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.39.5 update --finalize   # when every item below is resolved
npx zz-meridian@0.39.5 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.39.5 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:script:test:t2

script "test:t2" differs from Meridian's

Paths: `package.json`

Your "test:t2" script is "ZZ_GATEWAY=http://127.0.0.1:3125 node scripts/test-run.ts t2" and was kept; Meridian's is "node scripts/test-run.ts t2". Merge the two so the project's `test:t1` can call it, or leave yours if it already does the same work.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:script:test:t2",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-0d06e566ff56b48e9edab7f5019acb03ada4e1fe53e34017cee20d79461baa3f"
  }
}
```

### migration:script:test:release

script "test:release" differs from Meridian's

Paths: `package.json`

Your "test:release" script is "ZZ_GATEWAY=http://127.0.0.1:3125 node scripts/test-run.ts release" and was kept; Meridian's is "node scripts/test-run.ts release". Merge the two so the project's `test:t1` can call it, or leave yours if it already does the same work.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:script:test:release",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-0d06e566ff56b48e9edab7f5019acb03ada4e1fe53e34017cee20d79461baa3f"
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

- added/write: 4
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 295
- untouched/write: 13

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        leave   .agents/skills/zz-meridian/references/customize.md
untouched        leave   .agents/skills/zz-meridian/references/data-layers.md
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
untouched        leave   .claude/skills/zz-meridian/references/data-layers.md
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
untouched        write   scripts/audit.ts
untouched        leave   scripts/brand.ts
untouched        write   scripts/browser.ts
untouched        leave   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        write   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/answered.ts
untouched        leave   scripts/lib/args.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/attribution.ts
added            write   scripts/lib/audit-findings.ts
untouched        leave   scripts/lib/bin.ts
untouched        write   scripts/lib/browser-plan.ts
untouched        leave   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
untouched        leave   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/consumer-smoke.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep-inputs.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/effective-manifest.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        leave   scripts/lib/journey.ts
untouched        leave   scripts/lib/jsonc.ts
untouched        leave   scripts/lib/last-run.ts
untouched        leave   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/lint.ts
untouched        leave   scripts/lib/live-arrival.ts
added            write   scripts/lib/live-start.ts
untouched        leave   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/ownership-guide.ts
untouched        leave   scripts/lib/phone.ts
untouched        leave   scripts/lib/pool.ts
untouched        leave   scripts/lib/report-lines.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        write   scripts/lib/summary.ts
untouched        leave   scripts/lib/table-head.ts
untouched        leave   scripts/lib/team-config.ts
added            write   scripts/lib/tier2-seed.ts
untouched        leave   scripts/lib/tier2.ts
untouched        leave   scripts/lib/timing.ts
added            write   scripts/lib/unresponsive.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        leave   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        write   scripts/test-run.ts
untouched        leave   scripts/tokens.ts
untouched        leave   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/README.md
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/icons/README.md
untouched        leave   src/components/base/motion/README.md
untouched        leave   src/components/base/planes/README.md
untouched        leave   src/components/base/providers.tsx
untouched        leave   src/components/base/shell/README.md
untouched        leave   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/README.md
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/README.md
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/README.md
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/bar-list/levels.tsx
untouched        leave   src/components/charts/column-chart/README.md
untouched        leave   src/components/charts/column-chart/grouped.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/column-chart/shared.tsx
untouched        leave   src/components/charts/composition-bar/README.md
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/diverging-bars/README.md
untouched        leave   src/components/charts/diverging-bars/index.tsx
untouched        leave   src/components/charts/heatmap/README.md
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/interval-timeline/README.md
untouched        leave   src/components/charts/interval-timeline/index.tsx
untouched        leave   src/components/charts/meridian/README.md
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/range-strip/README.md
untouched        leave   src/components/charts/range-strip/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/README.md
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/README.md
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/README.md
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-settled.ts
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/charts/xy-line-chart/README.md
untouched        leave   src/components/charts/xy-line-chart/index.tsx
untouched        leave   src/components/patterns/activity-feed/README.md
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/README.md
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/README.md
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/README.md
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/README.md
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/command-palette/open.ts
untouched        leave   src/components/patterns/data-table/README.md
untouched        leave   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/README.md
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/README.md
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/README.md
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/README.md
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/README.md
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        leave   src/components/patterns/form-section/README.md
untouched        leave   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/README.md
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/README.md
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        leave   src/components/patterns/metric-tile/README.md
untouched        leave   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/README.md
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/README.md
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/README.md
untouched        leave   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/README.md
untouched        leave   src/components/patterns/prose/index.tsx
untouched        leave   src/components/patterns/rail/README.md
untouched        leave   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/rail/trail.ts
untouched        leave   src/components/patterns/shell-tools/README.md
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/README.md
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/templates/records/README.md
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/README.md
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/README.md
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/README.md
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/README.md
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/README.md
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/README.md
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/README.md
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/README.md
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/combobox/README.md
untouched        leave   src/components/ui/combobox/index.tsx
untouched        leave   src/components/ui/copy-field/README.md
untouched        leave   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/README.md
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/README.md
untouched        leave   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/disclosure/README.md
untouched        leave   src/components/ui/disclosure/index.tsx
untouched        leave   src/components/ui/empty-state/README.md
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/README.md
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/README.md
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/README.md
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/README.md
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/README.md
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/README.md
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/README.md
untouched        leave   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/README.md
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/README.md
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/README.md
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        leave   src/components/ui/search-input/README.md
untouched        leave   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/README.md
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/README.md
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/README.md
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/README.md
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/README.md
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/README.md
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/README.md
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/README.md
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/README.md
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/README.md
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/README.md
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/README.md
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/app-contract.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/calendar-date.ts
untouched        leave   src/lib/cn.ts
untouched        leave   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/contrast-pairs.ts
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
untouched        leave   src/lib/rank.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/lib/sort.ts
untouched        leave   src/logic/after-start.ts
untouched        leave   src/logic/derivations.ts
untouched        leave   src/logic/summarise.ts
untouched        leave   src/styles/base.css
untouched        leave   src/styles/fonts/Geist-Variable.woff2
untouched        leave   src/styles/fonts/GeistMono-Variable.woff2
untouched        leave   src/styles/fonts/LICENSE.txt
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

Finalizing runs `test:t1` — the Tier 1 tests affected by the change, the static checks and the type check — then a production build, the route policy and the size checks. The last two judge the project, not the release: the route policy needs `cacheComponents` and `partialPrefetching` in your Next config, and the size growth needs a `scripts/verify.baseline.json` you recorded (`node scripts/sizes.ts --write-baseline`); without them finalize reports that check `not run` with the reason, and never fails on it. `test:release` is the team's own gate before a release. To check by hand first:

```
pnpm run test:t1
node node_modules/next/dist/bin/next build
node scripts/route-policy.ts
node scripts/sizes.ts
```

## Changelog

The target release's changelog sections above 0.39.4:

```markdown
## [0.39.5] · 2026-11-15

### Changed

- **Only Tier 1 fails a run, and the checks were sorted by the rule's tiers.** Lint and the type check are Tier 3 and the contrast pairs are Tier 2, so all three of the test commands now run them, name what they found on the last line as `reported, not failed`, and exit 0 whatever they say. So does the audit's own look findings: a target under 44px on touch, text under its WCAG minimum, text cut but still visible (clipped, or an ellipsis that keeps the whole of it nowhere), text drawn past a box that does not clip it, a page or a region that scrolls sideways, a data page that does not fill its canvas, a table head that shows on a phone as stray words, a heading that skips a level, and a card that scrolls on its own. What still fails the run is content nobody can see or reach at all and an element a person cannot use: a route that answered an error, a page that rendered nothing, a table cut by a frame with no scroller, an unnamed control, a focus ring that never appears, focus landing on a control that draws nothing, two pieces of text in the same place, and a custom element the audit could not look inside. One function decides which list a failing check joins (`record` in `scripts/lib/summary.ts`) and one file decides the audit's (`scripts/lib/audit-findings.ts`), so no call site can sort a check by the habit of the code around it. Compilation is still Tier 1: `next build` fails on anything that cannot compile, and it runs in `test:t2` and `test:release`. The audit still exits 1 on a reach or use failure and 0 otherwise; `scripts/contrast.ts` keeps its own exit code, because `scripts/brand.ts` reads it to refuse an accent that ships a failing pair.
- **The 20-sample protocol is measured in its own job, and never inside a gate.** `pnpm test:release` no longer asks the browser for `--depth perf`, and neither does the release's Tier 2 stage. Twenty samples across three conditions and two devices outrun the clock a gate can carry: measured on one product, the protocol took its push gate from 1 h 47 m to 2 h 37 m against a 180-minute limit, so the gate started failing for the wrong reason — a slow measurement, not a broken one. The protocol now has a stage of its own, `node scripts/test-run.ts stage perf`: it builds, measures, records its values into the same `out/perf-record.json` the timed suites write, and exits 0 whatever it finds, so it cannot fail the job that runs it. Meridian's release runs it as a `perf` job beside `tier2`, both `continue-on-error`, and `tier2-attach` merges the two records so the Release keeps the protocol's values in its table and history; the weekly run measures it on the quiet runner it needs.

### Breaking

- **A workflow or a script that used a test command to hold lint, types or contrast no longer holds them.** `pnpm test:t1`, `pnpm test:t2` and `pnpm test:release` print what those found as `reported, not failed` and exit 0. Add a step of your own where you want them to block — `pnpm exec eslint .` and `pnpm exec tsc --noEmit` — and decide whether it stops the job. If your own push gate reads the audit's output, note that its Tier 2 findings have moved from `FAIL` to `reported:` and no longer change its exit code. An update reports the workflows affected as `reported-not-blocking`.
- **A push gate that relied on `pnpm test:release` for the protocol's numbers no longer gets them.** Run `node scripts/test-run.ts stage perf` from a step or job of its own with `continue-on-error: true` and a limit sized to it — a scheduled workflow is the usual home. Your `test:release` needs no change: it still runs every Tier 1 check, the timed suites, lint and the type check, and its summary now names the stage that holds the protocol's values. An update reports the workflows affected as `perf-outside-the-gate`.

### Fixed

- **A browser that stops answering is reported once, as a check that could not run, instead of as every page failing.** One run answered nothing at all for three hours — every page at every width, a route that does not exist included, `Runtime.evaluate timed out` — and the sweep reported 807 failures. Nothing had failed: the browser had stopped. (What was loading that machine is not established. No Chrome crash, no sleep or thermal event was recorded in the window, and the other work known to be running then was on a hosted runner; everything else on the machine is unknown.) A sweep now counts consecutive DevTools timeouts; on the third it opens a fresh tab and asks it for `1 + 1`. A busy machine answers, and the sweep carries on; a browser that has stopped does not, and the sweep ends with one line — `not run: the browser stopped answering: 3 pages in a row could not be measured (Emulation.setEmulatedMedia timed out), and a fresh tab did not answer either` — which also reaches the run's closing line. It is not a pass: the check did not run, so the run is not green. A page that wedges only its own main thread still fails as a page, because the browser behind it keeps answering. A browser that never starts — a `CHROME` path that names no browser, a binary that exits at once, or one that cannot answer while it is starting — is reported the same way, `not run: the browser could not start (<reason>)`, where it used to end the run with a stack trace.
- **The 20-sample protocol no longer fails a condition the product has no surface for.** `afterLive` starts its journey from a rail route that registers live data through the sample `LiveProvider`, so a product whose live layer is its own — a stream it re-reads in the browser — answered no route, and every `afterLive` combination failed for the want of a start: measured on one product, 36 lines reading `FAIL` with `no other rail route registers live data to start from` on a run that was otherwise green, which reads as a performance result and was an absent surface. The condition now leaves the run once, by name — `n/a  perf: afterLive (<why>)` with the probe it looked for, and `judged nothing: perf: afterLive (<why>)` at the end — so a protocol that measured two conditions does not read as one that measured three. Warm and cold measure as they always did, and a product where *some* rail route is live keeps `afterLive`: a destination no live route reaches is a gap in the rail, and still fails.
```

