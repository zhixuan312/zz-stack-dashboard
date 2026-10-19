<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:zz-meridian-agent-rules -->
# Built on ZZ Meridian 0.20.0

Follow the zz-meridian skill in `.agents/skills/zz-meridian/SKILL.md`.
Read `optional:docs/brief.md` for this team's product, users, data and decisions.
When it is absent, use the skill's brief template with the person's answers; do not invent product facts.

- What is yours: product pages, data, other team files, `src/app.config.ts` and `scripts/verify.config.ts`.
  Managed paths are recorded in `.meridian/manifest.json`; declared kept divergences are in
  `optional:.meridian/keep.json`. Explicit shared-file operations are described by the skill.
- Extend rather than edit: follow `.agents/skills/zz-meridian/references/customize.md`.
- Update: follow `.agents/skills/zz-meridian/references/update.md`. Installed files do not mean a completed
  upgrade: resolve the report and run the pinned finalization command.
- Before finishing: safely configured `pnpm verify` for the default gate/build/smoke path; report any partial coverage.
  Use `pnpm gate` alone for static feedback. Do not automatically chain it before verify, which already runs it.
  Use `pnpm verify --full` for the exhaustive checks and `pnpm verify --timed` for the timed ones (it needs a quiet
  machine); `--full --timed` is the whole standard. The 20-sample `--perf` protocol runs only in CI, split by route with `--shard <i>/<n>`; locally use `node scripts/perf.ts --routes <route>`. Weekly CI runs each tier as its own job.
- Agents in the product read through authorized collections and write only through an approved Proposal.
<!-- END:zz-meridian-agent-rules -->
