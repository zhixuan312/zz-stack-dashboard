# Who owns which file

Meridian manages a fixed set of files in a project, and `zz-meridian update` touches only those. Everything else is the
team's. This list is the rule the classifier itself uses, rendered from the zz-meridian package's own source: it changes with
the package, never by an edit here.

<!-- BEGIN:ownership -->
- Managed: the payload files under `tokens/`, `src/styles/` and `src/components/`, except each component's `README.md` and `preview.tsx`.
- Managed: the distributed scripts under `scripts/`, except `scripts/verify.config.ts`, the size baseline `optional:scripts/verify.baseline.json` (first-load JS and the HTML of each page) and a team-local `optional:scripts/check.local.ts`.
- Managed: the library helpers `src/lib/cn.ts`, `src/lib/format.ts`, `src/lib/format-date.ts`, `src/lib/period.ts`, `src/lib/color.ts`, `src/lib/host.ts`, `src/lib/preferences.ts`, `src/lib/csv.ts`, `src/lib/safe-markdown.ts`, `src/lib/logo.ts`, `src/lib/collection.ts`, `src/lib/explore.ts`, `src/lib/live.ts`, `src/lib/shared-context.ts`, `src/lib/agent-guidance.ts`, `src/lib/insight.ts`, `src/lib/facts.ts` and `src/lib/sort.ts`, and the assistant prompt `src/lib/assistant/prompt.ts`.
- Managed: the three `src/logic/` helpers a shipped component imports — `src/logic/after-start.ts`, `src/logic/derivations.ts` and `src/logic/summarise.ts` — so a payload's cards build in an adopted project; every other module under `src/logic/` is the team's.
- Managed: `src/views/console-chrome.tsx`, `tests/setup.ts`, and — in a project `create` made — every test the release ships, with the helpers under `tests/` they import. A shipped test pins the behaviour of the module it covers, so a release that changes one changes the other; a test the team edits is staged for its decision like any other edited file.
- Managed: `optional:scripts/package.json`, only when the adopt or create that set the project up generated it for this project shape.
- Managed: both installed skill trees, `optional:.agents/skills/zz-meridian/` and `optional:.claude/skills/zz-meridian/`, taken from the release's skill payload.
- Managed: the brand token and stylesheet paths under `tokens/` and `src/styles/` that the release generated from the recorded brand.
- Team-owned: every other product path, for example `src/app.config.ts`, `optional:src/views/`, `optional:src/data/`, `optional:src/logic/`, `optional:app/`, `optional:docs/`, `AGENTS.md` and `package.json`.
- Team-preserved: a path that was once recorded but is no longer managed, and any team file inside a managed folder, is never changed or deleted by an update.
- Kept: a path in the keep register (`optional:.meridian/keep.json`) is left as the team has it. When the new release removes it, it is retired-kept: still left, and recorded as retired.
<!-- END:ownership -->

Run `npx zz-meridian@latest update --dry-run` to see how each file is classified before anything changes.
