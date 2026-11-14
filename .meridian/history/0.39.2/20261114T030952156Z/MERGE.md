# Update 0.39.0 to 0.39.2

- Source: 0.39.0
- Target: 0.39.2
- Route: adopt
- Session: 20261114T030952156Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.39.2 update --finalize   # when every item below is resolved
npx zz-meridian@0.39.2 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.39.2 update --abort      # restore what the update changed and archive the session
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

### migration:verify-modes

`pnpm gate`, `pnpm verify` and the other removed commands are replaced by the three test commands.

Paths: `scripts/fake-gateway/journey.ts`, `scripts/fake-gateway/people.ts`, `scripts/fake-gateway/server.ts`, `scripts/fake-gateway/states-partial.ts`, `scripts/journeys.ts`, `scripts/primary-data.ts`, `scripts/states-timed.ts`, `scripts/verify.config.ts`, `src/console/no-access.tsx`, `tests/activity.test.tsx`, `tests/agent-side.test.ts`, `tests/approvals.test.tsx`, `tests/ceilings.test.tsx`, `tests/document-served.test.tsx`, `tests/fake-gateway-journey.test.ts`, `tests/fake-gateway-personas.test.ts`, `tests/fake-gateway-server.test.ts`, `tests/fake-gateway-start.ts`, `tests/fake-gateway-states.test.ts`, `tests/home-no-figure.test.tsx`, `tests/home.test.tsx`, `tests/html-weight.test.tsx`, `tests/journey-search.test.ts`, `tests/journeys-plan.test.ts`, `tests/knowledge-context.test.ts`, `tests/member-chrome.test.tsx`, `tests/no-figure.test.tsx`, `tests/platform-status.test.tsx`, `tests/plugins-figures.test.tsx`, `tests/plugins.test.tsx`, `tests/record.test.tsx`, `tests/retry-keeps-its-place.test.tsx`, `tests/review-work-a.test.tsx`, `tests/runs.test.tsx`, `tests/shell-first.test.tsx`, `tests/states-detail.test.tsx`, `tests/states-platform.test.tsx`, `tests/states-work.test.tsx`, `tests/table-columns.test.tsx`, `tests/team-figures.test.tsx`, `tests/teams-figures.test.tsx`, `tests/verify-tiers.test.ts`, `tests/view-contexts.test.ts`, `tests/work-fixture.tsx`

Read "Test runs" in AGENTS.md and "The tiers" in `references/validation.md`. `pnpm gate` and `pnpm verify` with its flags — `--full`, `--timed`, `--perf`, `--quick`, `--no-vitals` and `--extra` — are removed, and so are the `test`, `audit`, `interactions`, `live`, `keyboard` and `vitals` scripts and `scripts/gate.ts` and `scripts/verify.ts`. Run `pnpm test:t1` after a change (the affected Tier 1 tests, the static checks and the type check), `pnpm test:t2` when the change can alter what a page draws or a control does (the affected Tier 2 checks and the browser sweeps as well), and `pnpm test:release` before a release (every Tier 1 and Tier 2 test once, the timed browser suites, lint and the type check). None takes an argument: the command selects the tests. Replace every removed call in the files listed — scripts, workflows, shell files, documents and comments — and read the line each run ends with: it says what ran and what did not. `scripts/verify.config.ts` and `scripts/verify.baseline.json` stay.

Checks:

- `test:t1`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:verify-modes",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/fake-gateway/journey.ts": "sha256-7fce285bf2e89b6e2ffb2b427e815b1d7a5d9cbdec1439fe4e238b14aab46ea1",
    "scripts/fake-gateway/people.ts": "sha256-7a1ac4d9f506275ba20341903938a65ed02195fbb3faabb76df805722e67822b",
    "scripts/fake-gateway/server.ts": "sha256-fc878ee024d81af72f4333ec56a3f5e9ceff9a9dbec750763af7de748652bb8c",
    "scripts/fake-gateway/states-partial.ts": "sha256-d967484e38b51f45ba28db0c4769e4daa493d8896f6e2bc02b078728cb9f2b1e",
    "scripts/journeys.ts": "sha256-d978a8ee16c9739cd8aa8c9b0403ef3889cf7789e2886a0e90435648a6076ae7",
    "scripts/primary-data.ts": "sha256-02a0fa93734923deabd9731bd7becc94080fd040093125fdc15c724f50a4f2bc",
    "scripts/states-timed.ts": "sha256-448f9fb47abf76b55089ed528ecf54197dbbcbffcad6351da5dd95b80a8e0162",
    "scripts/verify.config.ts": "sha256-438d5612c6eea5bbc3d5aa2bd5cbcfee4c0a5198934b973bf18ea1ca1bd2cd5b",
    "src/console/no-access.tsx": "sha256-125616159895fddfdf4a9f5667ffc5eeb9cc1ed9c3d78806df1908207e62dcf5",
    "tests/activity.test.tsx": "sha256-2f212d00ad0ed2bea11ad078b21ee1debcb1edea449a820b90a4a121a496e22a",
    "tests/agent-side.test.ts": "sha256-89bb952388303e0d536a92e57b8820934b8a3e0176ddf3d4c089736baf53664a",
    "tests/approvals.test.tsx": "sha256-e38f0c0f6ffecdf332d7aa9208ccf783a3c42f66fd983b6315f744e6213af8c5",
    "tests/ceilings.test.tsx": "sha256-f97c8b67555219b4f5f8ed3c04948b876d3e75ff50abbf8c7285917c31a28f8b",
    "tests/document-served.test.tsx": "sha256-1020d423a1d3c9d44a8471c23f241ffb595f86a2a9c34adde9bb68c790da09f8",
    "tests/fake-gateway-journey.test.ts": "sha256-93e22e0916bebde0190785c9c034227d6118deba4eb3357c0324829d17e4b625",
    "tests/fake-gateway-personas.test.ts": "sha256-5c04036348aeeaceb6802d285d44bbfddef4d61c26bb3e8de2fe415adbc6fad5",
    "tests/fake-gateway-server.test.ts": "sha256-8b2e16a0f4fe4f16bf3a89c72d8c53063f4cd52ebb14f6f5acc8a306fa8dd8dd",
    "tests/fake-gateway-start.ts": "sha256-62afb287f9d9a7188cfd49ba68a1c6298e56a7a8c3e03870a861fb26d82a1036",
    "tests/fake-gateway-states.test.ts": "sha256-afe22c6164cab3fb4eb6f9ba1cd3ed28bc61cad772b12349098c346b41f79b94",
    "tests/home-no-figure.test.tsx": "sha256-b4b321cbe5208ef05b48f8e015035e95771258791a3159fa5e96c2d19b65ab79",
    "tests/home.test.tsx": "sha256-4a09018fec76cdb136976ba59fd92ece0b2bc38533bbe47ffa1809d5443a6efb",
    "tests/html-weight.test.tsx": "sha256-8b79117dc225d21aec8f130068b32b20d78f0e4632b3fb0b3aafc2793231ae58",
    "tests/journey-search.test.ts": "sha256-574ed9b0570fc6c8a37d26f6e371c95330b4c8a8a9993c742a91f54454fd7981",
    "tests/journeys-plan.test.ts": "sha256-d42612056f94e33e85805f1665aee0482258f203fb9c9ce001da948587613881",
    "tests/knowledge-context.test.ts": "sha256-31198abefd94a6897731cf15e94a1fb9a4b02287514cb1ec5456c67c5bd9e1ba",
    "tests/member-chrome.test.tsx": "sha256-a3deb619bff242fd69d5427ebd1758724d7076c12f27795ae6884b45e1e4ddf8",
    "tests/no-figure.test.tsx": "sha256-6f9f1eb484d4572d8e3efdecdddb17f0f1c5472df978ea0cc4c952c0ab521888",
    "tests/platform-status.test.tsx": "sha256-e97f02ddbc6054de9d39917a98b8a8c75d375acc3b827f14a3bce7630ad2244a",
    "tests/plugins-figures.test.tsx": "sha256-1b3d8fcd5052c3a351ac238d468b9f403033805f001f52edc2ffb5f07c2b8a3c",
    "tests/plugins.test.tsx": "sha256-09a3cae04e81877d1c6cefdadde3c040dca886340cf418d432058390d1c0f02e",
    "tests/record.test.tsx": "sha256-5f165bd11d7e9f7374e73f66d4f1e824e047af8a220d7c37f4eeac9e87794648",
    "tests/retry-keeps-its-place.test.tsx": "sha256-d5eb5a273c45444b09aa2728acc3f93b0f8e958f6c22519cab18a3cf38e18efe",
    "tests/review-work-a.test.tsx": "sha256-9d278b7ab6a1886c56c600edfdb41485b4277f6a1729106e7738ab1f93b0de1e",
    "tests/runs.test.tsx": "sha256-766b582d56ddbb4939af13019a579ed431f391c1fce6e6824bf969dd0a5c353e",
    "tests/shell-first.test.tsx": "sha256-29a1b301d4f75de2803eff4910660cf38eed004dd23c14349b8f2986bb5ccf18",
    "tests/states-detail.test.tsx": "sha256-f90f7550ce973f31c314efd0b2bcb7413c601014928c5441b198dc60a51cf2d0",
    "tests/states-platform.test.tsx": "sha256-1842697c05ff4f5cac055a86e85eabaa8b3df0918c375d737abdd944f2a6bf92",
    "tests/states-work.test.tsx": "sha256-b15714badfb60535f14fb2fe3c3b77632dbc940ba996f3feae781be41460c790",
    "tests/table-columns.test.tsx": "sha256-24d1f27f78c640cca9cdce8818beb0be34f52dcccca66dd807ca0f6ddb1b3d04",
    "tests/team-figures.test.tsx": "sha256-ddedf6694e9bec7ef33ebc095aa6e030d01fa6f8c8287f032183e932769713a8",
    "tests/teams-figures.test.tsx": "sha256-ef5ee7e69a2fda7eed0d1d2866a67888386b018d757030928fb14039c51a7ac7",
    "tests/verify-tiers.test.ts": "sha256-7afd02b8abc79a78d88a71183e00450f1528e9fc04bd5c9f1d7c9f7580f96819",
    "tests/view-contexts.test.ts": "sha256-95a25fcbf734df732be1877f4c2a298355f99f04bb22eac113943077437b26f8",
    "tests/work-fixture.tsx": "sha256-8d1c05eac670dd39b944a57eb2320dcb44ef96e91d0ad4102a67b2fa16fc0667"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `package.json`
- `scripts/fake-gateway/journey.ts`
- `scripts/fake-gateway/people.ts`
- `scripts/fake-gateway/server.ts`
- `scripts/fake-gateway/states-partial.ts`
- `scripts/journeys.ts`
- `scripts/primary-data.ts`
- `scripts/states-timed.ts`
- `scripts/verify.config.ts`
- `src/console/no-access.tsx`
- `tests/activity.test.tsx`
- `tests/agent-side.test.ts`
- `tests/approvals.test.tsx`
- `tests/ceilings.test.tsx`
- `tests/document-served.test.tsx`
- `tests/fake-gateway-journey.test.ts`
- `tests/fake-gateway-personas.test.ts`
- `tests/fake-gateway-server.test.ts`
- `tests/fake-gateway-start.ts`
- `tests/fake-gateway-states.test.ts`
- `tests/home-no-figure.test.tsx`
- `tests/home.test.tsx`
- `tests/html-weight.test.tsx`
- `tests/journey-search.test.ts`
- `tests/journeys-plan.test.ts`
- `tests/knowledge-context.test.ts`
- `tests/member-chrome.test.tsx`
- `tests/no-figure.test.tsx`
- `tests/platform-status.test.tsx`
- `tests/plugins-figures.test.tsx`
- `tests/plugins.test.tsx`
- `tests/record.test.tsx`
- `tests/retry-keeps-its-place.test.tsx`
- `tests/review-work-a.test.tsx`
- `tests/runs.test.tsx`
- `tests/shell-first.test.tsx`
- `tests/states-detail.test.tsx`
- `tests/states-platform.test.tsx`
- `tests/states-work.test.tsx`
- `tests/table-columns.test.tsx`
- `tests/team-figures.test.tsx`
- `tests/teams-figures.test.tsx`
- `tests/verify-tiers.test.ts`
- `tests/view-contexts.test.ts`
- `tests/work-fixture.tsx`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 2
- kept/leave: 3
- team-preserved/write: 1
- untouched/leave: 184
- untouched/write: 37

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
untouched        leave   .agents/skills/zz-meridian/references/validation.md
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
untouched        leave   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        leave   scripts/browser.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        write   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        write   scripts/lib/answered.ts
untouched        leave   scripts/lib/args.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/attribution.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
untouched        leave   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/consumer-smoke.ts
untouched        leave   scripts/lib/context-check.ts
untouched        write   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        write   scripts/lib/deep.ts
untouched        leave   scripts/lib/effective-manifest.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        write   scripts/lib/journey.ts
untouched        leave   scripts/lib/jsonc.ts
untouched        write   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/lint.ts
untouched        leave   scripts/lib/live-arrival.ts
untouched        leave   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
untouched        write   scripts/lib/ownership-guide.ts
untouched        leave   scripts/lib/phone.ts
added            write   scripts/lib/report-lines.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/summary.ts
added            write   scripts/lib/table-head.ts
untouched        leave   scripts/lib/team-config.ts
untouched        leave   scripts/lib/tier2.ts
untouched        leave   scripts/lib/timing.ts
untouched        write   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        write   scripts/sizes.ts
untouched        write   scripts/test-run.ts
untouched        leave   scripts/tokens.ts
untouched        write   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/bar-list/levels.tsx
untouched        leave   src/components/charts/column-chart/grouped.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/column-chart/shared.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/diverging-bars/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        write   src/components/charts/interval-timeline/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        write   src/components/charts/range-strip/index.tsx
untouched        write   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        write   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        write   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-settled.ts
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/charts/xy-line-chart/index.tsx
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        write   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/command-palette/open.ts
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
untouched        leave   src/components/patterns/rail/trail.ts
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/combobox/index.tsx
untouched        leave   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        write   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/disclosure/index.tsx
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        write   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        write   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        write   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/index.tsx
untouched        write   src/components/ui/sheet/index.tsx
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
untouched        leave   src/lib/calendar-date.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/contrast-pairs.ts
untouched        leave   src/lib/csv.ts
untouched        write   src/lib/explore.ts
untouched        leave   src/lib/facts.ts
kept             leave   src/lib/format-date.ts
untouched        write   src/lib/format.ts
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

The target release's changelog sections above 0.39.0:

```markdown
## [0.39.2] · 2026-11-12

### Fixed

- **Every day is counted in the project's reporting timezone** (#144). Dates were cut to their UTC day in the aggregate window and its day, week, month and weekday buckets, in both drill addresses, in the weekday averages and service strips, in a customer's busiest day and on the interval timeline's axis. A product east or west of UTC therefore counted an early-morning or late-evening record on the wrong day, and a drill address could open a day that held none of the figure. One rule now does every cut: a bare `YYYY-MM-DD` is kept as the day it names, and an instant is read as its day in `app.timezone`. `node scripts/check.ts` refuses a ten-character date cut in the product's layers, so the rule cannot drift back.
- **An explore filter takes the kind of value its author declared** (#145). A condition was handed to the collection whatever its value looked like, so `latency_ms gt "500"` matched nothing and read as an empty result. Every filter now declares `number`, `text`, `date` or `boolean`; the schema the model reads states it beside each field (`latency_ms (a number; gt, lt)`), and a value of another type is refused before anything is read, naming the field and the type. A `date` filter is a calendar day, `YYYY-MM-DD`, compared by the day it names in the reporting timezone, the same rule every other day cut uses. Nothing is coerced.
- **An update reads a created project from what that project's `create` actually wrote** (#146). A release is replayed by running `create` with the project's brand, so a managed file the project never received — `create` removes the Design Atlas and its tests after copying — is no longer treated as new and written back, and a shipped test of a page the project does not have can never reappear. A managed file the team deleted is recorded once as kept deleted in `.meridian/keep.json` and left out by every later update, including one the manifest never named (a project created before 0.29.0). Removing its entry restores the file on the next update, and an aborted update takes back the entries it wrote, leaving the register as it found it.

## [0.39.1] · 2026-11-12

### Fixed

- **An update removes the scripts a release retired, and names what still calls them** (#142). `update` reconciled only the scripts it still ships, so a 0.38.0 project updated to 0.39.0 kept `"gate": "node scripts/gate.ts"` and `"verify": "node scripts/verify.ts"` after both files were deleted. A script the recorded release wrote, still unchanged, and naming a `scripts/` file the target no longer ships is now removed and reported (`removed script gate`) in the console and in `MERGE.md`; one the team changed is kept and raises a migration naming the lost file, and one whose file still ships (`test`) is kept and named for its decision. The `verify-modes` migration is recurring and reads `package.json`, workflows, shell files, Markdown and code comments, so a stale `pnpm gate`, `pnpm verify`, `scripts/verify.ts` or one of the removed auxiliary scripts is named in `MERGE.md` instead of first failing `check.ts`. An adopted project's `AGENTS.md` block no longer describes Meridian's own release workflow, and a browser sweep whose every rail route redirects to one page (a sign-in wall) says so before judging any route `never-ready`.
- **Usage is a live page** (#139). Its read returns the revisions it was served and the body registers `days`, `hours`, `regions`, `endpoints` and `responses` with `useLive`, so a change recorded elsewhere redraws it. `/usage` is now an after-live start that draws `/requests`, which gives the navigation protocol the start it had lacked since the workspace move.
- **A streamed page's React placeholder race is no longer the page's error** (#143). React 19.3.1's inline Suspense completion script (`$RS`) can dereference a placeholder its deferred flush already removed, under CPU load, while the document is still parsing; it leaves the content complete and the page interactive, and the product raised nothing. The browser suites no longer count that exact signature — `parentNode` on null or undefined, thrown from `$RS` (React's `completeSegment`) with no application frame — as a console error; every other React boundary call (`$RC`, `$RX`, `$RV`) still fails. The tolerated occurrence is printed once per run as a known issue, so it stays visible without failing anything.

- **A dead server, a missing stage and a one-page list now say so.** `answerProblem` treated "no document answered" as a clean route, so a server that died mid-sweep had Chrome's own error page measured as every later route, and the audit, presses, keyboard walk and vitals passed; status 0 is now a named failure. `sizes.ts` printed a failed HTML check as `ok`; `test:t1` reported not run without Chrome and then ended "every Tier 1 and Tier 2 check passed"; `vitals.ts` counted pages over a floor as under it and called them "within 20%"; the audit's heading walk read the light DOM while every other rule entered open shadow roots; the presses judged a redirect by its 302, so a link to a 404 passed; an empty `smokeRoutes` list judged no route. Each is fixed, and the Docs rail route is in `detailRoutes` so the audit and presses visit it as well as timing it. A focus stop that draws nothing — a clipped head's button, a control at a pixel or transparent — is a named failure in the keyboard walk (`focus lands on a control that draws nothing`) and in the audit's 18 stops at every width, which finds it the way a person would rather than calling it hidden under whatever sits at its pixel. The keyboard walk takes `--width`, so the phone's own tab order can be walked. The audit's clipped-text rule read a clipped head's padded box (20x1) as visible and failed it at three widths; an absolutely positioned box at most a pixel wide or tall is not laid out for a reader.
- **The update and adopt paths.** A journal id is joined into `.meridian/history/`, and `parseJournal` accepted any string; it must now be one plain folder name. `assertSafeEntries` dropped middle empty segments before refusing them. The CLI read Next config files in the wrong order and included a `.cjs` Next never loads; it now follows `CONFIG_FILES` (js, mjs, ts, mts). An IO error in `adopt`'s write loop escaped as a stack trace with half the files written; it now names what was written. `adopt` finds a layout's stylesheet through the project's own alias and refuses an import it cannot resolve, and adds `src/**` to a tsconfig `include` that named only the team's folders. `create` chooses npm before branding rewrites the README, so the project is not told to run pnpm on a machine without it. `--resume` refreshes `MERGE.md`'s resolution-stub hashes after applying, and `brand --product` writes the README with the package manager it is told.
- **The dashboard's user-facing defects.** A failed endpoint read no longer takes a request's page down; the home embed's Open link keeps the day it shows; the error screen omits its support reference when there is none; an applied proposal stays applied when it is remounted in the same document (a host that recreates the iframe starts at Needs you; this demo keeps no proposal record, and its apply is the same values); sign-in, the only door into a gated product, has an error boundary; the embed requests view says which page it is showing and no longer promises a customer button its read does not carry; API keys' copy says the Key manager add-on is what lets a Member write. In the cards: DataTable keeps its page-size control when every row fits the chosen size, hides one-page navigation, and visually hides (rather than removes) its headers on a phone, where a sortable head keeps its words for a screen reader and draws no button — a clipped button would be a tab stop nobody can see; a rail badge no longer repeats its destination inside the link; a sparkline's live region is outside its `role="img"`; dialog, sheet, drawer and search closes answer the 44px touch target; a `Field` label names a `RadioGroup` by `aria-labelledby`. The interval timeline draws its now line over the plot and only inside its window, and a readout measured against the plot; the range strip draws a value with only its low end measured. Home and Usage say "Today is still in progress" when the day in progress holds traffic; Home draws no compute figure without a compute row; Usage names no busiest hour on an all-zero grid; Members reads a date-only last active as a day. A compact money figure under one unit keeps its cents; a compact number with a spaced unit keeps the unit; the footer says nothing when no service is monitored. Tests and Releases each read the other's collection and now ask for both grants; a `create_tickets` call that names a state is refused, and a member role change retires its cached read before the Activity line can fail.
- **The type check no longer reaches the build and scratch folders.** Its include is `**/*.ts`, so a `.ts` left in `out/` — a probe, a one-off script — was typechecked, and removing it before the next incremental check failed `tsc` with `TS6053` for a file that no longer existed. `out`, `build`, `coverage`, `test-results`, `.turbo`, `.vercel` and `.meridian/update` are excluded now; Next's generated `.next/types` stay in. An adopting project gets the same list from the update.
- **An unknown Atlas entry answers 404.** `notFound()` was thrown inside the page's Suspense after the shell had flushed, so a dead `/system/...` URL answered 200 with the not-found screen.

### Breaking

- **`adopt` refuses a symbolic link at a payload path.** A link to a file carrying the packaged bytes used to read as already-owned; it is now a conflict, like a directory or a different file, and its target is never read. Replace the link with the file (or move it aside) and run adopt again.
- **`update --verify` is refused.** It had been accepted and ignored since `--finalize` took over the verification, so a person who named it waited for a check nothing ran. The flag is unknown now; `--finalize` is the step that verifies.

### Known issues

- **The `$RS` placeholder race is React Fizz's, not the dashboard's** (#143). The check now tolerates it, but the throw itself is still in `react-dom` 19.3.1: a deferred `$RV` flush removes a nested placeholder before that placeholder's own `$RS` runs. It has no user-visible effect. An upstream report to React is the owner's call; until it is fixed, a page may log the exception once under heavy CPU throttling.
```

