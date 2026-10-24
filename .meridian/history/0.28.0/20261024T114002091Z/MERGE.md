# Update 0.26.0 to 0.28.0

- Source: 0.26.0
- Target: 0.28.0
- Route: adopt
- Session: 20261024T114002091Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.28.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.28.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.28.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:four-layers

The template's figures and sentences moved into `src/logic/`: thirty-eight modules left `src/views/` and `src/data/`.

Paths: `app/(dash)/(home)/page.tsx`, `app/(dash)/(home)/read-home.ts`, `app/api/assistant/route.ts`, `src/views/pages/home.tsx`, `src/views/tools/home.ts`, `src/views/tools/releases.ts`, `src/views/tools/usage.ts`, `tests/access-context.test.ts`, `tests/agent-side.test.ts`, `tests/assistant-access.test.ts`, `tests/assistant-change-rule.test.ts`, `tests/assistant-tool-sweep.test.ts`, `tests/explore-contract.test.ts`, `tests/home-context.test.ts`, `tests/home-no-figure.test.tsx`, `tests/home.test.tsx`, `tests/member-chrome.test.tsx`, `tests/old-addresses.test.ts`, `tests/prepared-aggregate.test.ts`, `tests/review-work-a.test.tsx`, `tests/review-work-d.test.tsx`, `tests/review-work-i.test.tsx`, `tests/sweep-approvals.test.tsx`, `tests/sweep-paths.test.tsx`, `tests/verify-tiers.test.ts`, `tests/view-contexts.test.ts`

Read "The four layers" and "The path an existing product follows" in references/data-layers.md. Thirty-eight modules moved into the logic layer, and each import of one in your own `src/views/` producers and pages names the path it left: `src/data/alerts.ts` → `src/logic/alerts.ts`, `src/components/patterns/status-list/summarise.ts` → `src/logic/summarise.ts`, `src/views/customer-context.ts` → `src/logic/customer-context.ts`, `src/views/customer-explore.ts` → `src/logic/customer-explore.ts`, `src/views/customers-context.ts` → `src/logic/customers-context.ts`, `src/views/customers-explore.ts` → `src/logic/customers-explore.ts`, `src/views/fact-insight.ts` → `src/logic/fact-insight.ts`, `src/views/home-context.ts` → `src/logic/home-context.ts`, `src/views/home-explore.ts` → `src/logic/home-explore.ts`, `src/views/home-parts.ts` → `src/logic/home-parts.ts`, `src/views/key-scopes.ts` → `src/logic/key-scopes.ts`, `src/views/keys-context.ts` → `src/logic/keys-context.ts`, `src/views/keys-explore.ts` → `src/logic/keys-explore.ts`, `src/views/main-summary.ts` → `src/logic/main-summary.ts`, `src/views/members-context.ts` → `src/logic/members-context.ts`, `src/views/members-explore.ts` → `src/logic/members-explore.ts`, `src/views/now-context.ts` → `src/logic/now-context.ts`, `src/views/now-explore.ts` → `src/logic/now-explore.ts`, `src/views/now-parts.ts` → `src/logic/now-parts.ts`, `src/views/releases-context.ts` → `src/logic/releases-context.ts`, `src/views/releases-explore.ts` → `src/logic/releases-explore.ts`, `src/views/request-context.ts` → `src/logic/request-context.ts`, `src/views/request-explore.ts` → `src/logic/request-explore.ts`, `src/views/requests-context.ts` → `src/logic/requests-context.ts`, `src/views/requests-explore.ts` → `src/logic/requests-explore.ts`, `src/views/revenue-context.ts` → `src/logic/revenue-context.ts`, `src/views/revenue-explore.ts` → `src/logic/revenue-explore.ts`, `src/views/revenue-parts.ts` → `src/logic/revenue-parts.ts`, `src/views/services-context.ts` → `src/logic/services-context.ts`, `src/views/services-explore.ts` → `src/logic/services-explore.ts`, `src/views/tests-context.ts` → `src/logic/tests-context.ts`, `src/views/tests-explore.ts` → `src/logic/tests-explore.ts`, `src/views/tickets-context.ts` → `src/logic/tickets-context.ts`, `src/views/tickets-explore.ts` → `src/logic/tickets-explore.ts`, `src/views/tools.ts` → `src/logic/tools.ts`, `src/views/usage-context.ts` → `src/logic/usage-context.ts`, `src/views/usage-explore.ts` → `src/logic/usage-explore.ts`, `src/views/usage-parts.ts` → `src/logic/usage-parts.ts`. Rewrite each import to the path the module has now, or move your own module beside the work it does. Two symbols left a card of Meridian's, and both must be rewritten because the update replaces the card: `afterStart`, which the incident card exported, is `@/logic/after-start`, and `summarise`, which the status list re-exported, is `@/logic/summarise`. Every other path your own files name is still there, so a project that imported neither symbol keeps building as it was. The six layer rules stay off until your own `scripts/check.local.ts` exports `fourLayers = true`; turn them on once your figures have moved, and the gate and the build are what show the work is done.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:four-layers",
  "status": "resolved",
  "reason": "",
  "files": {
    "app/(dash)/(home)/page.tsx": "sha256-52854cc1fbb6b9a86ea61a1dd57cc16768246823e7f2af2843bfc7a6d07c9e9b",
    "app/(dash)/(home)/read-home.ts": "sha256-f330d9a0b0a0c24a2ba6c5d9cb256747fc9568c545d619787b19579c9c46cadf",
    "app/api/assistant/route.ts": "sha256-57053eb98bc5c0dc63170b8916d61f14cd1e1ee2158e87edcf6d3c60f9b9b3cc",
    "src/views/pages/home.tsx": "sha256-f102b54624cdbec720346e5e3f834a6dd6a5a79408a1a7c2846f0711ad2e87b0",
    "src/views/tools/home.ts": "sha256-bad2a531bf4ea492f7a2b0708e2da81d0b5ecfc0d619e4d48c8324a2ba90e3ef",
    "src/views/tools/releases.ts": "sha256-43d0be9a3e17678fdf3efce05dce327b022745334ef7d75de66633b28365da76",
    "src/views/tools/usage.ts": "sha256-6038a097d179d217c6a20ad993e46fe414ae6f5c7f7c405ba69f58847ce9f002",
    "tests/access-context.test.ts": "sha256-55159df033beff876bd82cc716c2cac2b119c78fe6919762a0aafa53e26e6cf8",
    "tests/agent-side.test.ts": "sha256-a58d44ccca8c4d6a173ac1248b003e6b77d974b902fa9b4a56cfb88e7897c74b",
    "tests/assistant-access.test.ts": "sha256-d4055d4d36af0d157d93563a89c9523cad60e6306d3599e6d314f40949caaad0",
    "tests/assistant-change-rule.test.ts": "sha256-8bd407c505ef961d73eb1a6f8247803a3d0450bebb2e225311c98e204e4a6eb2",
    "tests/assistant-tool-sweep.test.ts": "sha256-612f342c3202bb040a0e8e44fc1f2491d78d165c94c234dfba10673b044ab86f",
    "tests/explore-contract.test.ts": "sha256-ab87d4fd3d07d1578ec7a504ff7e73bb658a6eb4409ccebd8512157e8e5ba2f7",
    "tests/home-context.test.ts": "sha256-3a6af7617abce99923c3ef8a999f2a6298ad7ca8cd9cbd7e05510d743d01f6dc",
    "tests/home-no-figure.test.tsx": "sha256-144b74dbad405081e1af58db1a4886e29da00efb9588bab1679ab73842ea5a4c",
    "tests/home.test.tsx": "sha256-95eeb61c82ff4a6b16040b4f4b7bba3b45075ab8b0eaaf4cb58674b5202242e2",
    "tests/member-chrome.test.tsx": "sha256-5002d8f0eb33d37f160910828b608e715baa24ddf5bd48049465e8aba728dd4e",
    "tests/old-addresses.test.ts": "sha256-369e548363f62c40773773b8d8a78d70bc1f1739576a55432110b2fb599fee34",
    "tests/prepared-aggregate.test.ts": "sha256-19f23081df8e72bfe175011c1cdbf4258c6b9d04633c23b4ba695e6a03bc15ba",
    "tests/review-work-a.test.tsx": "sha256-081e96a49b0015f1a0284aa474fee72484a83afe50d11921ea150a054f5e803d",
    "tests/review-work-d.test.tsx": "sha256-59688b744eda1dbfd9c30543b86447aed2bff789e06d972cd1f254d916cbbdd2",
    "tests/review-work-i.test.tsx": "sha256-ec0be396a4782af0fdee2545810d90e737a62fb5ca6f4c3aea304d869412210e",
    "tests/sweep-approvals.test.tsx": "sha256-c80cad9889dd511b0fd9ebb271d48549c912e30cc7f286cd3498eb8c11c83b82",
    "tests/sweep-paths.test.tsx": "sha256-78b24b8424ef53f7200880b7cbe0ae8c8316aed9a0a5664c38bec60a531c70a9",
    "tests/verify-tiers.test.ts": "sha256-20325e011eb94d73f7663fa3d672959724fc78d478e9eca72ee882145257b91c",
    "tests/view-contexts.test.ts": "sha256-78b6bd6feb3635cba22d5f533695b55f5e0979e324d229f70ef44c9aac91def4"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `app/(dash)/(home)/page.tsx`
- `app/(dash)/(home)/read-home.ts`
- `app/api/assistant/route.ts`
- `src/views/pages/home.tsx`
- `src/views/tools/home.ts`
- `src/views/tools/releases.ts`
- `src/views/tools/usage.ts`
- `tests/access-context.test.ts`
- `tests/agent-side.test.ts`
- `tests/assistant-access.test.ts`
- `tests/assistant-change-rule.test.ts`
- `tests/assistant-tool-sweep.test.ts`
- `tests/explore-contract.test.ts`
- `tests/home-context.test.ts`
- `tests/home-no-figure.test.tsx`
- `tests/home.test.tsx`
- `tests/member-chrome.test.tsx`
- `tests/old-addresses.test.ts`
- `tests/prepared-aggregate.test.ts`
- `tests/review-work-a.test.tsx`
- `tests/review-work-d.test.tsx`
- `tests/review-work-i.test.tsx`
- `tests/sweep-approvals.test.tsx`
- `tests/sweep-paths.test.tsx`
- `tests/verify-tiers.test.ts`
- `tests/view-contexts.test.ts`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 6
- kept/leave: 2
- removed/delete: 1
- team-preserved/write: 1
- untouched/leave: 152
- untouched/write: 34

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        write   .agents/skills/zz-meridian/references/agents.md
untouched        write   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
added            write   .agents/skills/zz-meridian/references/data-layers.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        leave   .agents/skills/zz-meridian/references/live.md
untouched        write   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        leave   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        leave   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        write   .claude/skills/zz-meridian/SKILL.md
untouched        write   .claude/skills/zz-meridian/references/agents.md
untouched        write   .claude/skills/zz-meridian/references/cache.md
untouched        write   .claude/skills/zz-meridian/references/customize.md
added            write   .claude/skills/zz-meridian/references/data-layers.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        leave   .claude/skills/zz-meridian/references/live.md
untouched        write   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        leave   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        leave   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        write   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        leave   scripts/brand.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        write   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
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
added            write   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/phone.ts
untouched        write   scripts/lib/routes.ts
untouched        write   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/shard.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/slots.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        write   scripts/live.ts
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
untouched        write   src/components/charts/column-chart/index.tsx
untouched        write   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        write   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        write   src/components/charts/trend-chart/index.tsx
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
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        leave   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        write   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/index.tsx
untouched        write   src/components/patterns/prose/index.tsx
untouched        write   src/components/patterns/rail/index.tsx
untouched        write   src/components/patterns/shell-tools/index.tsx
untouched        write   src/components/patterns/status-list/index.tsx
removed          delete  src/components/patterns/status-list/summarise.ts
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
added            write   src/logic/after-start.ts
added            write   src/logic/derivations.ts
added            write   src/logic/summarise.ts
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

The target release's changelog sections above 0.26.0:

```markdown
## [0.28.0] · 2026-10-24

### Breaking

- **The four data layers are the standard, and the template's figures moved into `src/logic/`.** Thirty-eight modules that computed a figure or wrote a sentence — thirty-six under `src/views/`, the status list's `summarise`, and the alerts the dashboard layout reads — live in `src/logic/` now, and every import names the path each has. `docs/data-layers.md` is the standard: the four layers between a database and the screen, the contract a backend answers, the seven direct reads, and the order a product with its own API or tables follows.
  - **What a team does.** Run `update`; it reports `migration:four-layers` for each of your own files that still imports a module from a path the move left, and its instruction names all thirty-eight with the path each left. Rewrite each of those imports in your own `src/views/` producers and pages to `src/logic/`, or move the module itself beside the work it does. Two symbols left the cards they were exported from and must move with them: `afterStart` is `@/logic/after-start`, and `summarise` is `@/logic/summarise`.
  - **Doing nothing.** A project that imported neither symbol keeps building: the move is in this template, not in your project, so every path your own files name is still there. A file of yours that imported `afterStart` from `src/components/patterns/incident-card`, or `summarise` from `src/components/patterns/status-list`, stops compiling — both cards are Meridian's and the update replaces them. What no project gets by doing nothing is the layer: your figures stay where they were, and the six rules below stay silent about them until you move them and say so.
  - **Three helpers arrive managed.** `src/logic/after-start.ts`, `src/logic/derivations.ts` and `src/logic/summarise.ts` are Meridian's from this release, because a shipped card imports them: `update` replaces each when you have not edited it, and stages base, ours and new when you have. Every other module under `src/logic/` is yours.
  - **Six rules, off until you ask.** `node scripts/check.ts` checks `data-imports-neither`, `logic-does-not-import-views`, `views-produce-nothing`, `presentation-does-not-read`, `no-direct-query` and `client-does-not-import-a-reading-module`. Every one is silent until your own `scripts/check.local.ts` exports `fourLayers = true`; until then the check runs exactly as it did before. `docs/data-layers.md`'s "The six rules, and the switch" says what each asks and what skipping it costs.

### Known issues

- **Three routes are over their first-load budget, and no fix ships in this release.** The refusal chain left the layout's chunk group when the data layer stopped importing `@/views`: `/engineering` first-loads 832 KiB against the 820 KiB cap, `/business` is over the same 820 KiB cap, and `/customers/[id]` grew 5.6% against a 5% budget. On 2026-10-24 the owner decided the cap stays. No fix is planned in this release: the plan records that no honest product change restores the sharing, and a known issue that promises a fix nobody has is worse than one that says there is none. If that decision is ever revisited, the cap moves as a row under `## Budgets` in `docs/testing.md` — the section a changed limit is recorded in — and each route's own baseline in `scripts/verify.baseline.json` is the other place the numbers live.

## [0.27.1] · 2026-10-24

### Fixed

- **`verify` and `live` start the app they measure on loopback** ([#81](https://github.com/zhixuan312/zz-meridian/issues/81)). `next start` with no host bound every interface, so for the half hour a full run takes, the app under test — served with the fake data source — answered on the local network. Both start it with `-H 127.0.0.1`; every client of a run already reached it there.
- **The keyboard walk and the presses open a disclosure before reaching into it** ([#82](https://github.com/zhixuan312/zz-meridian/issues/82)). A closed `<details>` lays its content out without drawing it, so a button inside was tagged as visible and never reached, and its press found nothing at its centre; `verify --full` failed a page with a folded table. Both suites open the disclosures they walk into, and the presses leave shut the one whose own `summary` holds the control.
- **The shell's Search button keeps its name below 40rem** ([#83](https://github.com/zhixuan312/zz-meridian/issues/83)). The only word naming it was `display: none`, leaving an icon-only button with no accessible name on every view at 390px. It is `sr-only` now: the word is not drawn, and it is still the button's name.
- **The rail's menu trigger separates the product name from the workspace** ([#84](https://github.com/zhixuan312/zz-meridian/issues/84)). Its visible text ran the two together, and WCAG 2.5.3 asks for the visible label inside the accessible name, where a comma alone kept them apart. A space now sits between them: invisible between two block spans, present for the name.
- **A table written in a server component lays out like one written on the client** ([#85](https://github.com/zhixuan312/zz-meridian/issues/85)). `Table` found its columns by component identity, and a server component reaches the client table as lazy references, so it found none and drew every column as one. It counts them from the table's shape now: the first row of the first section that has one, its component cells, through fragments.
- **The audit fails a strip that scrolls sideways at a phone width, and text drawn past a box that does not clip it** ([#86](https://github.com/zhixuan312/zz-meridian/issues/86)). A strip of chips wider than 390px hid its last items with nothing saying so, and a figure too long for its grid column passed while drawn over its neighbour and past its card. The first is reported unless it is the page's scroll region or draws the system's cut-edge fade (`scroll-fade-x`); the second is measured on the glyphs with a `Range`. The stricter reading found the Atlas counts row overflowing its cells at 1024, which now keeps four columns until `xl` and draws a rule only at the start of a row. The prose tables and code blocks that legitimately scroll now draw that fade.

## [0.27.0] · 2026-10-23

### Breaking

- **A chart's scale holds every value it draws, zero among them** ([#80](https://github.com/zhixuan312/zz-meridian/issues/80)). `ticksBetween` counts a floor under zero down to a step under it, where it used to clamp it to zero and draw every value below zero under the axis and out of the card.
  - `TrendChart` without a `floor` now holds zero and every value: a series that goes under zero takes the axis down with it. An `area` is filled to the zero line from either side, not down to the lowest level.
  - `TrendChart`'s top is the data's own. It was at least 1, so a ratio that peaks at 0.4% was drawn along the floor of an axis to 100%. A chart whose values are all under 1 now draws to a step over its highest value.
  - Levels are rounded to a digit under their step, not to six places, so a ratio a millionth apart keeps one level per tick.
- **`ColumnChart` draws a value under zero as a fall** ([#78](https://github.com/zhixuan312/zz-meridian/issues/78)). In the plain form, a value under zero used to draw nothing. Now the scale goes under zero, zero is drawn as the axis, and the column hangs from the zero line, rounded at its lower end, with its value under it. While no value is under zero the chart is drawn as before. Stacked, a part under zero is still no contribution: parts make a whole.

### New

- **`TrendChart`'s `format` may be a function, with an `axisFormat`** ([#78](https://github.com/zhixuan312/zz-meridian/issues/78)). From a client component, pass `(n: number) => string` for a figure no named format says exactly: a price to four decimals, a ratio to six, or an amount in a currency of its own. It reads the readout and the table, and the axis unless `axisFormat` says otherwise. A server component still passes a name, because a function cannot cross into a client component.
- The Trend chart's Atlas page draws "Below zero" and "A format of its own". The Column chart's page draws "Rises and falls".

### Fixed

- **The rail keeps the whole product name and workspace in a `title`** ([#79](https://github.com/zhixuan312/zz-meridian/issues/79)). A name too long for the rail, such as 23 characters in three words, was cut with an ellipsis and nothing held the whole of it, so `scripts/audit.ts` failed every route at every width.
- **The Now embed loads its body only when it draws it.** The inline view a chat shows first draws the open incident and the services; Now's whole body, with its charts, tables and feed, is the fullscreen view, now a chunk of its own (`next/dynamic`). In a created project, `/embed/now`'s first-load JS falls from 820 KiB, at the cap, to 712 KiB. `app/embed/now/view.tsx` is a sample file the team owns, so `update` leaves a project's own copy as it is: one whose embed nears the cap can take the release's.
```

