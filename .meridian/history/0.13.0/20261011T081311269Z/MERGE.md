# Update 0.3.0 to 0.13.0

- Source: 0.3.0
- Target: 0.13.0
- Route: adopt
- Session: 20261011T081311269Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.13.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.13.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.13.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### file:.agents/skills/zz-meridian/SKILL.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.agents/skills/zz-meridian/SKILL.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.agents/skills/zz-meridian/SKILL.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/SKILL.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/SKILL.md": null
  }
}
```

### file:.agents/skills/zz-meridian/references/customize.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.agents/skills/zz-meridian/references/customize.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.agents/skills/zz-meridian/references/customize.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/customize.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/customize.md": null
  }
}
```

### file:.agents/skills/zz-meridian/references/existing-project.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.agents/skills/zz-meridian/references/existing-project.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.agents/skills/zz-meridian/references/existing-project.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/existing-project.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/existing-project.md": null
  }
}
```

### file:.agents/skills/zz-meridian/references/validation.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.agents/skills/zz-meridian/references/validation.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.agents/skills/zz-meridian/references/validation.md`

Resolution stub:

```json
{
  "id": "file:.agents/skills/zz-meridian/references/validation.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".agents/skills/zz-meridian/references/validation.md": null
  }
}
```

### file:.claude/skills/zz-meridian/SKILL.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.claude/skills/zz-meridian/SKILL.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.claude/skills/zz-meridian/SKILL.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/SKILL.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/SKILL.md": null
  }
}
```

### file:.claude/skills/zz-meridian/references/customize.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.claude/skills/zz-meridian/references/customize.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.claude/skills/zz-meridian/references/customize.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/customize.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/customize.md": null
  }
}
```

### file:.claude/skills/zz-meridian/references/existing-project.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.claude/skills/zz-meridian/references/existing-project.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.claude/skills/zz-meridian/references/existing-project.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/existing-project.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/existing-project.md": null
  }
}
```

### file:.claude/skills/zz-meridian/references/validation.md

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/.claude/skills/zz-meridian/references/validation.md`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/.claude/skills/zz-meridian/references/validation.md`

Resolution stub:

```json
{
  "id": "file:.claude/skills/zz-meridian/references/validation.md",
  "status": "resolved",
  "reason": "",
  "files": {
    ".claude/skills/zz-meridian/references/validation.md": null
  }
}
```

### file:scripts/assistant.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/scripts/assistant.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/scripts/assistant.ts`

Resolution stub:

```json
{
  "id": "file:scripts/assistant.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/assistant.ts": null
  }
}
```

### file:scripts/brand.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/scripts/brand.ts`
- ours: `.meridian/update/0.13.0/ours/scripts/brand.ts`
- new: `.meridian/update/0.13.0/new/scripts/brand.ts`

Resolution stub:

```json
{
  "id": "file:scripts/brand.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/brand.ts": "sha256-4f38012c5adc700f7dd031f3e55f07c8f4c4461cca0a4dfb688370a52334b65a"
  }
}
```

### file:scripts/check.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/scripts/check.ts`
- ours: `.meridian/update/0.13.0/ours/scripts/check.ts`
- new: `.meridian/update/0.13.0/new/scripts/check.ts`

Resolution stub:

```json
{
  "id": "file:scripts/check.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/check.ts": "sha256-ea7e75ef08c6769df7e7dcb1e40ef1a70c1cce58ae00abdcb6e647e41fd34717"
  }
}
```

### file:scripts/fake-llm.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/scripts/fake-llm.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/scripts/fake-llm.ts`

Resolution stub:

```json
{
  "id": "file:scripts/fake-llm.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/fake-llm.ts": null
  }
}
```

### file:scripts/keyboard.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/scripts/keyboard.ts`
- ours: `.meridian/update/0.13.0/ours/scripts/keyboard.ts`
- new: `.meridian/update/0.13.0/new/scripts/keyboard.ts`

Resolution stub:

```json
{
  "id": "file:scripts/keyboard.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/keyboard.ts": "sha256-89c0960e3a99afca47b56b91c05703111e9afca6dcce9c83ffc2bfc4eadf79ee"
  }
}
```

### file:scripts/verify.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/scripts/verify.ts`
- ours: `.meridian/update/0.13.0/ours/scripts/verify.ts`
- new: `.meridian/update/0.13.0/new/scripts/verify.ts`

Resolution stub:

```json
{
  "id": "file:scripts/verify.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/verify.ts": "sha256-46f27f3516e2156c5f020e6f1c7c06d1e48aca12be03aedba8c73f58bfc8ebdb"
  }
}
```

### file:scripts/vitals.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/scripts/vitals.ts`
- ours: `.meridian/update/0.13.0/ours/scripts/vitals.ts`
- new: `.meridian/update/0.13.0/new/scripts/vitals.ts`

Resolution stub:

```json
{
  "id": "file:scripts/vitals.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/vitals.ts": "sha256-476fe0787c1b9479f217603b76cfa9511de7da4c773a9aca3acdf03fd210c25d"
  }
}
```

### file:src/components/base/app-mark/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/base/app-mark/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/base/app-mark/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/base/app-mark/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/base/app-mark/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/app-mark/index.tsx": "sha256-588816cbaa212bfdf4e1839cc1832477dd58552c290dea970f5706efff3c450b"
  }
}
```

### file:src/components/base/providers.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/base/providers.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/base/providers.tsx`
- new: `.meridian/update/0.13.0/new/src/components/base/providers.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/base/providers.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/providers.tsx": "sha256-cc45adfd35eeda8c2173bf6e290d22d91d1fd45497c12ef3ce71bbcd3d344a6d"
  }
}
```

### file:src/components/base/shell/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/base/shell/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/base/shell/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/base/shell/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/base/shell/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/shell/index.tsx": "sha256-78537c3b3ba033ea1b95f7292a776943a348de06a3337ff12505ee0768bad5f3"
  }
}
```

### file:src/components/base/surface/index.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/base/surface/index.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/base/surface/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/base/surface/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/surface/index.tsx": null
  }
}
```

### file:src/components/base/use-share-view.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/base/use-share-view.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/base/use-share-view.ts`

Resolution stub:

```json
{
  "id": "file:src/components/base/use-share-view.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/base/use-share-view.ts": null
  }
}
```

### file:src/components/charts/timeline/index.tsx

removed: Meridian removed this file, and you edited it. Decide whether to delete it or keep it.

- base: `.meridian/update/0.13.0/base/src/components/charts/timeline/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/charts/timeline/index.tsx`
- new: `absent`

Resolution stub:

```json
{
  "id": "file:src/components/charts/timeline/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/charts/timeline/index.tsx": "sha256-ed5120125895ee169769455c04214202efe950933b81a719ad635c7de1ab0986"
  }
}
```

### file:src/components/patterns/ask-about/index.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/ask-about/index.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/ask-about/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/ask-about/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/ask-about/index.tsx": null
  }
}
```

### file:src/components/patterns/assistant/index.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/assistant/index.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/assistant/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/assistant/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/assistant/index.tsx": null
  }
}
```

### file:src/components/patterns/assistant/text.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/assistant/text.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/assistant/text.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/assistant/text.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/assistant/text.tsx": null
  }
}
```

### file:src/components/patterns/assistant/thread.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/assistant/thread.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/assistant/thread.ts`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/assistant/thread.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/assistant/thread.ts": null
  }
}
```

### file:src/components/patterns/data-table/use-query-state.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/data-table/use-query-state.ts`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/data-table/use-query-state.ts`
- new: `.meridian/update/0.13.0/new/src/components/patterns/data-table/use-query-state.ts`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/data-table/use-query-state.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/data-table/use-query-state.ts": "sha256-a30593a3c467f27ba08ce732b6ac83e64548016e9af1cb4228973f7d64ad20d6"
  }
}
```

### file:src/components/patterns/embed-frame/index.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/embed-frame/index.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/embed-frame/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/embed-frame/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/embed-frame/index.tsx": null
  }
}
```

### file:src/components/patterns/filter-bar/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/filter-bar/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/filter-bar/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/patterns/filter-bar/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/filter-bar/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/filter-bar/index.tsx": "sha256-b42ca01b83eb79f9092bef8accc8e3696aa746825bb7a3e050338aacd79d6c93"
  }
}
```

### file:src/components/patterns/form-section/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/form-section/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/form-section/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/patterns/form-section/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/form-section/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/form-section/index.tsx": "sha256-40de89ab1b36cb051101996741715b27153803a2ab8e34b20cc4c36cacac2a04"
  }
}
```

### file:src/components/patterns/period-select/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/period-select/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/period-select/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/patterns/period-select/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/period-select/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/period-select/index.tsx": "sha256-3878c8360849271f4df02b9068800b073f38196afe5d9af44cf06488bafecbd9"
  }
}
```

### file:src/components/patterns/proposal/index.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/components/patterns/proposal/index.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/components/patterns/proposal/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/proposal/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/proposal/index.tsx": null
  }
}
```

### file:src/components/patterns/prose/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/prose/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/prose/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/patterns/prose/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/prose/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/prose/index.tsx": "sha256-82120e1a5129132495240d20f19c8e26831603c60a606a8dbf8e3af3a1352253"
  }
}
```

### file:src/components/patterns/rail/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/rail/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/rail/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/patterns/rail/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/rail/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/rail/index.tsx": "sha256-8e437b7fee763a397403c369f465ead5f50429da3f152bb32c2e8066ec186693"
  }
}
```

### file:src/components/patterns/status-list/summarise.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/patterns/status-list/summarise.ts`
- ours: `.meridian/update/0.13.0/ours/src/components/patterns/status-list/summarise.ts`
- new: `.meridian/update/0.13.0/new/src/components/patterns/status-list/summarise.ts`

Resolution stub:

```json
{
  "id": "file:src/components/patterns/status-list/summarise.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/patterns/status-list/summarise.ts": "sha256-2dac46cf0f126df546b2f9bf1c30f4cfe017b979e45a8f1baf904c65461ff174"
  }
}
```

### file:src/components/ui/card/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/ui/card/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/ui/card/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/ui/card/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/card/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/card/index.tsx": "sha256-e1dd79192dbc31787a3339941db6e2a7115446eb43312d4e93cb413b0d6a7113"
  }
}
```

### file:src/components/ui/search-input/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/ui/search-input/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/ui/search-input/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/ui/search-input/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/search-input/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/search-input/index.tsx": "sha256-cc04f3872d7aa4077f508f5dad9f496518ceeb0423d67a73a4b603a96f4389b5"
  }
}
```

### file:src/components/ui/segmented/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/ui/segmented/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/ui/segmented/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/ui/segmented/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/segmented/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/segmented/index.tsx": "sha256-375d5d2563de8450ebabfe567e4f5c8991a4fc356c2daf926d3ef04eed301703"
  }
}
```

### file:src/components/ui/toast/index.tsx

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/components/ui/toast/index.tsx`
- ours: `.meridian/update/0.13.0/ours/src/components/ui/toast/index.tsx`
- new: `.meridian/update/0.13.0/new/src/components/ui/toast/index.tsx`

Resolution stub:

```json
{
  "id": "file:src/components/ui/toast/index.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/components/ui/toast/index.tsx": "sha256-a6d89be50b2bfc1a8b881e1943f477bad46308cfb144d733b66e5f8667ad05f4"
  }
}
```

### file:src/lib/assistant/prompt.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/lib/assistant/prompt.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/lib/assistant/prompt.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/assistant/prompt.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/assistant/prompt.ts": null
  }
}
```

### file:src/lib/color.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/color.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/color.ts`
- new: `.meridian/update/0.13.0/new/src/lib/color.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/color.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/color.ts": "sha256-4082e8f7101db9545af2c2d5dd5163b519e0e33a5fc97a01d90fb79af9e548bb"
  }
}
```

### file:src/lib/format-date.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/format-date.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/format-date.ts`
- new: `.meridian/update/0.13.0/new/src/lib/format-date.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/format-date.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/format-date.ts": "sha256-236147d669bc3f2f1113918c55a5e3c8132971a1da4b2ddb55b3e59d6dba7c32"
  }
}
```

### file:src/lib/format.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/format.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/format.ts`
- new: `.meridian/update/0.13.0/new/src/lib/format.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/format.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/format.ts": "sha256-f4ef4257c2d4fd648869f0b3af6dc1890bb8ec8b0ccab4ae4ccf08346d02bf8d"
  }
}
```

### file:src/lib/host.ts

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/lib/host.ts`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/lib/host.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/host.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/host.ts": null
  }
}
```

### file:src/lib/period.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/period.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/period.ts`
- new: `.meridian/update/0.13.0/new/src/lib/period.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/period.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/period.ts": "sha256-03c60f0ef98aa5e3827f9613f6b4865fd1927b0813ed35789fe73ca3b0a74d8a"
  }
}
```

### file:src/lib/preferences.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/preferences.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/preferences.ts`
- new: `.meridian/update/0.13.0/new/src/lib/preferences.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/preferences.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/preferences.ts": "sha256-e8a5da294ddd36cc182ea1496ad88fed61495ab2cdd74c2d5abee1d413ae5512"
  }
}
```

### file:src/lib/safe-markdown.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/src/lib/safe-markdown.ts`
- ours: `.meridian/update/0.13.0/ours/src/lib/safe-markdown.ts`
- new: `.meridian/update/0.13.0/new/src/lib/safe-markdown.ts`

Resolution stub:

```json
{
  "id": "file:src/lib/safe-markdown.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/safe-markdown.ts": "sha256-7f801a48fffeb5abdcae2c249f1dfc3b1701c97fda38f99a8b84dbc86cfb2265"
  }
}
```

### file:src/views/console-chrome.tsx

local-deletion: You deleted this managed file and Meridian still ships it. Decide whether it stays out or comes back.

- base: `.meridian/update/0.13.0/base/src/views/console-chrome.tsx`
- ours: `absent`
- new: `.meridian/update/0.13.0/new/src/views/console-chrome.tsx`

Resolution stub:

```json
{
  "id": "file:src/views/console-chrome.tsx",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/views/console-chrome.tsx": null
  }
}
```

### file:tests/setup.ts

edited: You edited this managed file and Meridian changed it too. Combine the two versions.

- base: `.meridian/update/0.13.0/base/tests/setup.ts`
- ours: `.meridian/update/0.13.0/ours/tests/setup.ts`
- new: `.meridian/update/0.13.0/new/tests/setup.ts`

Resolution stub:

```json
{
  "id": "file:tests/setup.ts",
  "status": "resolved",
  "reason": "",
  "files": {
    "tests/setup.ts": "sha256-726bd16a08e393ed3ce02fe47db6c24dd9be710d7d50548958a67f34c826efd5"
  }
}
```

### migration:dependency:vitest

vitest ^4.1.8 is an older major than the tested ^5.0.3

Paths: `package.json`

Meridian is tested against vitest ^5.0.3; your ^4.1.8 is a lower major and is incompatible. Follow the vitest upgrade guide to reach ^5.0.3, then run the project's gate.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:dependency:vitest",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-b62dc979a8a3212b1aec3f204b04af2f45701f62f5fa4e208224bae56c8f8f1e"
  }
}
```

### migration:dependency:jsdom

jsdom ^29.1.1 is an older major than the tested ^30.1.1

Paths: `package.json`

Meridian is tested against jsdom ^30.1.1; your ^29.1.1 is a lower major and is incompatible. Follow the jsdom upgrade guide to reach ^30.1.1, then run the project's gate.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:dependency:jsdom",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-b62dc979a8a3212b1aec3f204b04af2f45701f62f5fa4e208224bae56c8f8f1e"
  }
}
```

### migration:clock-now-required

Freshness, ShellTools, AlertsPanel and formatRelative take the data clock explicitly.

Paths: `app/(dash)/knowledge/page.tsx`, `src/console/frame.tsx`, `src/console/page.tsx`, `src/console/when.tsx`

Read "The clock is the data's" in references/cache.md. Pass `now` (the read's `observedAt`, or the data's clock) to each `<Freshness>`, `<ShellTools>` and `<AlertsPanel>`, and as the second argument of `formatRelative`. None of them reads the browser's clock any more.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:clock-now-required",
  "status": "resolved",
  "reason": "",
  "files": {
    "app/(dash)/knowledge/page.tsx": "sha256-f1eea771c48301f4fb98baf377bcb9bf92f6a2a3e2e8c6ca10f8054c1dfca233",
    "src/console/frame.tsx": "sha256-6c102c41e78bc7bd6a5038aeef00e652eefccbd09ae740a9f0704e9cbe7ed7b0",
    "src/console/page.tsx": "sha256-8b46ae96c39d7a6ee248e9bed7739884303b47bfe32c7032acc04c94feac10e9",
    "src/console/when.tsx": "sha256-1884a514e4a5430307af04a59bdad89b3e314a9ef84f0ca5103d21252109976e"
  }
}
```

### migration:cache-components-config

next.config sets cacheComponents and partialPrefetching.

Paths: `next.config.ts`

Read "Turn Cache Components on" in references/cache.md. Add `cacheComponents: true` and `partialPrefetching: true` to the Next config, then make every route static or partial: a page that reads the request or an uncached source streams that part behind its own Suspense boundary.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:cache-components-config",
  "status": "resolved",
  "reason": "",
  "files": {
    "next.config.ts": "sha256-a8d57cb4e1cfd4a240fa66608c5fcf767fb3186ca826383383588b415c839e80"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `app/(dash)/knowledge/page.tsx`
- `next.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `src/console/frame.tsx`
- `src/console/page.tsx`
- `src/console/when.tsx`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 41
- edited/stage: 26
- local-deletion/stage: 21
- removed/stage: 1
- team-preserved/leave: 2
- team-preserved/write: 3
- untouched/leave: 44
- untouched/write: 36

<details><summary>Every path</summary>

```
local-deletion   stage   .agents/skills/zz-meridian/SKILL.md
added            write   .agents/skills/zz-meridian/references/agents.md
added            write   .agents/skills/zz-meridian/references/cache.md
local-deletion   stage   .agents/skills/zz-meridian/references/customize.md
local-deletion   stage   .agents/skills/zz-meridian/references/existing-project.md
added            write   .agents/skills/zz-meridian/references/live.md
added            write   .agents/skills/zz-meridian/references/ownership.md
added            write   .agents/skills/zz-meridian/references/register.md
added            write   .agents/skills/zz-meridian/references/standard.md
added            write   .agents/skills/zz-meridian/references/update.md
local-deletion   stage   .agents/skills/zz-meridian/references/validation.md
added            write   .agents/skills/zz-meridian/references/voice.md
local-deletion   stage   .claude/skills/zz-meridian/SKILL.md
added            write   .claude/skills/zz-meridian/references/agents.md
added            write   .claude/skills/zz-meridian/references/cache.md
local-deletion   stage   .claude/skills/zz-meridian/references/customize.md
local-deletion   stage   .claude/skills/zz-meridian/references/existing-project.md
added            write   .claude/skills/zz-meridian/references/live.md
added            write   .claude/skills/zz-meridian/references/ownership.md
added            write   .claude/skills/zz-meridian/references/register.md
added            write   .claude/skills/zz-meridian/references/standard.md
added            write   .claude/skills/zz-meridian/references/update.md
local-deletion   stage   .claude/skills/zz-meridian/references/validation.md
added            write   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
team-preserved   write   package.json
team-preserved   write   pnpm-lock.yaml
local-deletion   stage   scripts/assistant.ts
untouched        write   scripts/audit.ts
edited           stage   scripts/brand.ts
edited           stage   scripts/check.ts
untouched        write   scripts/contrast.ts
local-deletion   stage   scripts/fake-llm.ts
untouched        write   scripts/gate.ts
untouched        write   scripts/interactions.ts
edited           stage   scripts/keyboard.ts
added            write   scripts/lib/aliases.ts
untouched        write   scripts/lib/bin.ts
added            write   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
added            write   scripts/lib/context-check.ts
added            write   scripts/lib/contrast-pairs.ts
added            write   scripts/lib/coverage.ts
added            write   scripts/lib/deep.ts
added            write   scripts/lib/next-config.ts
untouched        write   scripts/lib/routes.ts
added            write   scripts/lib/sample.ts
added            write   scripts/lib/sizes.ts
added            write   scripts/lib/timing.ts
added            write   scripts/lib/update-session.ts
added            write   scripts/live.ts
added            write   scripts/navigate.ts
added            write   scripts/perf.ts
added            write   scripts/rail.ts
untouched        write   scripts/registry.ts
added            write   scripts/route-policy.ts
untouched        write   scripts/shot.ts
added            write   scripts/sizes.ts
untouched        write   scripts/tokens.ts
team-preserved   leave   scripts/verify.config.ts
edited           stage   scripts/verify.ts
edited           stage   scripts/vitals.ts
team-preserved   leave   src/app.config.ts
edited           stage   src/components/base/app-mark/index.tsx
edited           stage   src/components/base/providers.tsx
edited           stage   src/components/base/shell/index.tsx
local-deletion   stage   src/components/base/surface/index.tsx
added            write   src/components/base/text-roles/index.tsx
local-deletion   stage   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        write   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        write   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/scale.ts
untouched        write   src/components/charts/sparkline/index.tsx
removed          stage   src/components/charts/timeline/index.tsx
untouched        write   src/components/charts/trend-chart/index.tsx
untouched        write   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        write   src/components/patterns/appearance-menu/index.tsx
local-deletion   stage   src/components/patterns/ask-about/index.tsx
local-deletion   stage   src/components/patterns/assistant/index.tsx
added            write   src/components/patterns/assistant/launcher.tsx
local-deletion   stage   src/components/patterns/assistant/text.tsx
local-deletion   stage   src/components/patterns/assistant/thread.ts
untouched        write   src/components/patterns/command-palette/index.tsx
untouched        write   src/components/patterns/data-table/index.tsx
edited           stage   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
local-deletion   stage   src/components/patterns/embed-frame/index.tsx
untouched        write   src/components/patterns/export-button/index.tsx
untouched        write   src/components/patterns/featured-metric/index.tsx
edited           stage   src/components/patterns/filter-bar/index.tsx
edited           stage   src/components/patterns/form-section/index.tsx
untouched        write   src/components/patterns/freshness/index.tsx
untouched        write   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
edited           stage   src/components/patterns/period-select/index.tsx
local-deletion   stage   src/components/patterns/proposal/index.tsx
edited           stage   src/components/patterns/prose/index.tsx
edited           stage   src/components/patterns/rail/index.tsx
untouched        write   src/components/patterns/shell-tools/index.tsx
untouched        write   src/components/patterns/status-list/index.tsx
edited           stage   src/components/patterns/status-list/summarise.ts
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        write   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
edited           stage   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/index.tsx
untouched        write   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/index.tsx
untouched        write   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
edited           stage   src/components/ui/search-input/index.tsx
edited           stage   src/components/ui/segmented/index.tsx
untouched        write   src/components/ui/select/index.tsx
untouched        write   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        write   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
edited           stage   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
added            write   src/lib/agent-guidance.ts
local-deletion   stage   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
added            write   src/lib/collection.ts
edited           stage   src/lib/color.ts
untouched        write   src/lib/csv.ts
edited           stage   src/lib/format-date.ts
edited           stage   src/lib/format.ts
local-deletion   stage   src/lib/host.ts
added            write   src/lib/insight.ts
added            write   src/lib/live.ts
added            write   src/lib/logo.ts
edited           stage   src/lib/period.ts
edited           stage   src/lib/preferences.ts
edited           stage   src/lib/safe-markdown.ts
added            write   src/lib/shared-context.ts
untouched        write   src/styles/base.css
untouched        write   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        write   src/styles/tokens.css
local-deletion   stage   src/views/console-chrome.tsx
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

The target release's changelog sections above 0.3.0:

```markdown
## [0.13.0] · 2026-10-11

### Added

- **A navigation check may carry its own budget.** An entry in `scripts/verify.config.ts`'s `navigationChecks` gains an optional `budget` — `{ shellMs: { phone: 300 } }` — which stands in for the shared `budgets.navigation` figure on that one metric and device for that one route; every figure it does not name, and every other route, keeps the shared one, and the shared figure itself is unchanged. The template uses it once: `/system/start/start-a-dashboard`, the longest reading page in the repository, whose phone shell measures 243-282 ms on the 4x-throttled profile against the shared 250. Beside it in the config is what that cost is not — this route's payload is smaller than the commit before the access work (152,388 bytes against 157,080), and `585349a` measures the same with byte-identical HTML — and the measurement lives in the initiative's review Backlog. Additive: a config with no `budget` behaves exactly as before.
- **The consistency gate fails a nav item whose `needs` is not a need.** `node scripts/check.ts` reads `nav` from `src/app.config.ts` and fails, naming the href, when an item's `needs` is neither `'public'`, nor a grant (`object:read|create|update|remove`), nor `{ allOf: [...] }` of grants — including the empty and the nested `allOf`. It checks the shape of a need and never the role table, so it passes whatever grants a project declares, and it holds in a product as well as in the template because `src/app.config.ts` is every project's own file.
- **`pnpm verify --as <persona>` signs the browser in as someone else, and is opt-in.** `scripts/verify.config.ts` declares five personas (`owner`, `admin`, `member`, `key-manager`, `viewer`) with the member id each stands for, its hand-written `expectedRoutes` and the protected string each of its denied routes must not leak. The run compares the rail with those routes, presses the role-dependent controls (`/keys`, `/members`, `/settings`) at 1440px, and opens every other rail route expecting NoAccess. An unknown persona exits non-zero naming the declared ones and `--as` cannot combine with `--perf`, both before anything is built. Without `--as`, `pnpm verify` is unchanged. `scripts/lib/chrome.ts`'s `Page.open` gains an optional `cookie` (set before the first request), `scripts/rail.ts` is new (it prints the rail's links as the browser drew them), and `scripts/audit.ts`, `scripts/interactions.ts` and `scripts/keyboard.ts` gain `--as`; `interactions.ts` also gains `--width`. All additive.
- **The Members page shows a Roles & access matrix, generated from the tables.** `src/views/roles-matrix.tsx` is new: `matrixRows()` and `RolesMatrix()` build a card whose columns are `MAIN_ROLES` then `ADD_ONS` and whose rows are the non-public features (their `title`) then the actions (their `label`), each ticked where `whoCan(need)` says that role's own grants satisfy the whole need, with a legend saying that an add-on adds to a main role and that the member rules still apply. It renders on `/members` inside the page's own stack, so the page's gate is its gate, and the table scrolls inside its own frame at a phone's width. Nothing is listed by hand — editing `src/data/roles.ts` or `src/data/features.ts` edits the section.
- **Every member write passes one boundary.** `src/data/member-mutations.ts` is new: `membersFor(scope)` binds the members collection so its `create`, `update` and `remove` all pass the boundary; `assignMemberRole({ id, role, addOns })` is the one assignment path; `memberAccess(id)` answers a row's capabilities, its role and add-on choices and its target-only reason; `invitableRoles()` is the invite choices. It re-resolves the caller from the request's own scope, enforces the Owner, self, give-Owner and last-active-Owner rules with the fixed messages, and runs every write in one promise queue per workspace.
- **The gate is one idiom.** `src/data/access.ts` gains `gate(feature)` and `requireNeed(need)`: a dashboard page opens with the gate — a person who may not open it gets the NoAccess view as a normal 200, and a request with no session is sent to `/sign-in` — and a view tool calls `requireNeed` before it reads. Both ask `may`, and `may` answers from `effective(role, addOns)`, the one union rule, so the policy and the role table cannot drift.
- **The empty state has a no-access kind.** `EmptyState` gains `kind="no-access"`: a lock mark on the neutral disc (`fill-track`, `ink-3`), `data-no-access` on its root, and no `role="alert"` (only `error` is an alert). `src/views/no-access.tsx` generates its copy from the role table — `noAccessCopy(need, title)` names the feature and the roles whose own grants satisfy the whole need, and says a main role plus an add-on is needed when no single role does.
- **A member's role and add-ons are data, not a fixture list.** The role table moved into a new `src/data/roles.ts` (`MAIN_ROLES`, `ADD_ONS`, `GRANTS`, `effective(role, addOns)`, `whoCan(need)`), and `ROLES` left the member fixture and `src/data/sample.ts`. A member record now carries `role` (a main role, default `Member`) and `addOns` (default `[]`, duplicates removed), so the members collection refuses an unknown role or add-on and an update that does not name either leaves it as it was. Anything importing `ROLES` from `@/data/sample` takes `MAIN_ROLES` from `@/data/roles` instead.
- **The demo signs in as whoever the View as cookie names.** `src/data/access.ts` reads the `zz_meridian_view_as` cookie on every request and answers grants from the member's own record: no cookie signs in as Maya Chen (`members_1`), the five frozen personas are `PERSONAS`, and an unknown or non-Active id gives no session — never the Owner. The scope keeps its three fields but its values change: `subjectId` is a member id and `authorizationKey` is `demo:<id>:<role>:<add-ons deduped and sorted>`, so code that hard-coded `subjectId: 'owner'` or `demo:1` must read the scope instead. `src/data/view-as.ts` (`'use server'`) adds `chooseViewAs(id)`, which sets the cookie for an Active persona and throws a readable message otherwise.
- **The demo sign-in offers the personas.** Without `DEMO_PASSWORD`, the sign-in page lists the five personas above the product's sign-in panel — each with their name and role, a non-Active one disabled — and a click opens the console as that person through the View as cookie; with `DEMO_PASSWORD`, "Open the demo" gains an "Open as" select (default Maya Chen) beside the password and sets both the gate and the View as cookie. A persona outside the list, or one whose record is not Active, sets nothing, and the choice never bypasses the password.

### Changed

- **The Members page offers each row only what that person may do.** A row's menu is drawn from the boundary's answer for that row and that target: withheld controls are not rendered at all, a row that offers nothing says why, and a caller without the member grants sees no row menu, no Invite member control and one line saying who can (`Owners and Admins manage members.`). New: a `Change role` row action opening a sheet whose role select and add-on choices are exactly what that row allows, submitting through `assignRole`; the Activity line is written by the boundary, not the page. The phone card now carries the role with its add-ons (`Member + Key manager`) — and since Meridian's card shows three facts, Joined moved to the table only and the card keeps Last active.
- **The assistant never exceeds the person it acts for.** `src/lib/collection.ts` gains `pageOnlyFields` (fields an agent reads and never writes) and `writableFields(c)`; the members collection declares `pageOnlyFields: ['role', 'addOns']`, so `create_members` and `update_members` leave them out of their schemas and refuse them if sent anyway. `app/api/assistant/route.ts` registers a `view_<name>` tool only where the person satisfies that view's need, hands `members` in through the boundary, and forces an agent's member create to `role: 'Member'` with no add-ons (FR-12). `src/lib/assistant/scoped.ts` is new: `scopedQuery(collection, scope, name)` re-checks the same tenant and subject and the read grant at the moment a query runs, so a tool listed before a demotion refuses after it. Nothing to do for an adopter unless they declare their own `pageOnlyFields`.
- **The demo policy binds `members` through the boundary.** `src/data/access.ts`'s `bind(scope, 'members')` returns `membersFor(scope)`, and `app/(dashboard)/members/actions.ts` routes `inviteMember`, `setMemberStatus` and `removeMember` through it, exports `assignRole`, and no longer invalidates the tag itself. A person may no longer suspend or remove themselves, and a change that would leave the workspace with no active Owner is refused — including a status change through `update`, which is new.
- **The three paths that skipped the permission read go through the data layer.** `src/data/collections.ts` gains `customers` (the twelve sample rows, read-only) and `workspace` (one record: the name, address and time zone the Settings form shows), `/customers` and the customers view tool reach them through `read()`, so `customers:read` is asked on the same path as every other collection, and Settings saves through a new server action (`saveWorkspace`) that asks `ACTIONS['save-workspace'].needs`. The Analytics heatmap, hours and regions come from `analyticsFigures()` in `src/data/analytics.ts`, which refuses a scope without `requests:read`. `CUSTOMERS` is no longer re-exported by `src/data/sample.ts` — take it from `@/system/fixtures/sample-records`, or read the `customers` collection; `SettingsBody` gains optional `workspace` and `save` props.
- **A general action is shown only where the person may perform it.** `KeysView` takes `may: { create; revoke }` and `line`, and `RequestView` takes `mayReplay` and `replayLine`: each control is hidden — never drawn disabled, never left to fail on submit — when the person may not use it, and the page shows one line saying who can. `ACTIONS` in `src/data/features.ts` gains an optional `line`, and `src/views/no-access.tsx` exports `actionLine(id)`. Both view props are optional, so an existing direct caller of a view is unaffected.
- **Settings shows each section by what a person may do.** `SettingsBody` takes a required `may: { workspaceRead; workspaceUpdate; workspaceRemove }`, computed on the server page from the grant table. The Workspace section appears only to someone who may read it — read-only, with the line "Only an Owner can change the workspace." and no save bar, when they may not change it — and the Danger zone only to someone who may remove the workspace; a Member or Viewer no longer sees the Workspace section at all. Notifications, Appearance, Assistant and Agents and MCP stay for everyone.
- **A view tool carries its feature's need and asks it before it reads.** `ViewTool` gains a required `needs: Need`, so an adopter's own view tools must declare one (`needs: FEATURES.<id>.needs`) and call `await requireNeed(FEATURES.<id>.needs)` as the first statement of their `read`. Tool filtering by need is what keeps the assistant's `view_*` tools matching the person it acts for.
- **Every dashboard page asks its feature before it reads.** Each page opens with its gate, `/keys` drops its hand-written check, and `/requests/[id]`'s `generateMetadata` answers the feature title `Request` for a person who may not open it without reading the record. A page that awaits its gate is an async page, so `/`, `/analytics`, `/customers` and `/requests` stream their masthead with the gate rather than in the static shell, and `OverviewPage`/`AnalyticsPage` accept a defaulted props object.
- **`NoAccess` takes a feature, not a title, and is async.** `src/views/no-access.tsx` exports `NoAccess({ feature }: { feature: FeatureId })` — awaited — in place of `NoAccess({ title })`; a caller that passed `title` passes a `FeatureId` and awaits it.
- **A nav item carries its feature's need, so the rail asks one table.** `src/data/features.ts` is new: `FEATURES` (what each page needs), `ACTIONS` (what each control needs), and the `FeatureId` and `ActionId` types. Every item in `src/app.config.ts`'s `nav` now writes `needs: FEATURES.<id>.needs` by reference, and `NavItem` gains a required `needs: Need` — so every adopter's nav item must add one: import `FEATURES` and point each item at its feature, or write a `Need` (`'keys:read'`, `{ allOf: [...] }`, `'public'`) directly. The rail and the palette then show only the destinations the current person may reach: a Viewer sees eight of the ten (`/keys` and `/members` are gone) and every other role sees all ten. This is presentation only — a destination kept out of the rail is still reachable by its address, and every page keeps its own check.
- **The console's chrome takes the request as a promise.** `ConsoleRail` no longer takes `user`, and neither it nor `ConsolePalette` takes `only`; both take `access?: Promise<ChromeAccess | null>` — `chromeAccess()` from `src/data/access.ts` — which the layout passes without awaiting. Each piece of chrome waits for it in its own `<Suspense>` boundary, so the frame stays in the static shell and the person's own rail streams in the same response: nothing about the identity is drawn and then taken away. A product that passed `only` or `user` passes `access={chromeAccess()}` instead, or its own promise of the same shape — a console with no sign-in passes no `access` at all. `skills/zz-meridian/references/existing-project.md` shows the new call.

### Fixed

- **The demo policy binds the customers and the workspace.** `DEMO_COLLECTIONS` in `src/data/access.ts` gains `customers` and `workspace`, so the `customers:read` and `workspace:*` grants the role table freezes are reachable through `read()` — without them `/customers` refused everybody, the Owner included.
- **`/keys` asks `keys:read` before it reads.** The keys page checks the caller's grant first: a Viewer gets a minimal NoAccess view (a normal 200 holding none of the keys' records) and a request with no session is redirected to `/sign-in`, both before any read. The new `src/views/no-access.tsx` holds that view.
- **A key records the person who made it.** Creating an API key stored the sample's own person as the owner, so a key Lucas Meyer created said Maya Chen made it. The owner is now the caller the policy names.
- **A closed browser check leaves no Chrome profile behind**: `scripts/lib/chrome.ts` removed a closed browser's profile from a timer that never ran when the script exited at once, so every `verify`, audit or shot left one in the temp folder. It now removes it as soon as the browser is closed — in the background, never on the caller's path. A suite closes its browser inside a hook, a hook has a ten-second ceiling, and a profile that has loaded many pages runs to tens of megabytes, so removing one synchronously timed a hook out on a runner (`Hook timed out in 10000ms`, `tests/deep-dom.test.ts`'s `afterAll`) after first failing with `ENOTEMPTY: directory not empty` when Chrome was still writing into it. That test now asserts the close does not do that work on the caller's path. A project brought in with `adopt` gets the fix with `update`.
- **A card is one class**: Card's look moved from a dozen utilities to `.card` in `base.css`, and the Data table's wrapper uses it too, so every page carries less HTML (`/health` from 102,225 to 98,154 bytes, `/requests` from 148,614 to 141,568). A utility on a card still overrides it.
- **Removing a member is undone, not confirmed.** Remove takes the person off the table at once with a toast offering Undo; the removal is sent when the toast closes (`UNDO_MS`, 8 s, now exported by the Toast) or at once if the page goes away first, and a refusal brings them back with its reason. Revoking an API key keeps its confirmation.
- **A page reached by a click no longer replays its arrival** (#19). On a client navigation, or when the router shows a page it kept, the shell marks its main area `data-still`: arrivals end at once in their final state, and the mark lifts after `dur-grow` + `dur-enter`, so a later change on the page (a new period) still animates. The first load of a visit arrives as before.
- **`navigate.ts` times real content** (#18): its `data` time no longer counts a skeleton's rows or the rows of a page the router keeps hidden, so a `loading.tsx` that holds a click for 300 ms or more now shows in `data`, where it read as the skeleton's 30 ms before.
- **A rail link answers a click before its page arrives** (#18): its icon becomes a Spinner while a page that is not prefetched is on the way (`useLinkStatus`). `cache.md`, `customize.md` and `standard.md` now say what a request-time read costs a navigation (React holds a shown fallback 300 ms or more) and to read through `read()` wherever the data allows.
- **The rail's marker measures after paint**, so opening the phone drawer costs one render and no forced layout; the current link draws the same pill until it has.
- **A trend chart's readout stays inside its chart**: it measures its own width, wraps a long label and keeps an extreme value whole; on a phone it pins to the plot's leading edge. Money axis ticks from $10,000 read at a glance (`$25K`, `$5.0B`). `scripts/shot.ts --point "<chart>" --at 0.6` captures a readout.
- **A sort or a page press is answered before the server is.** `useQueryState` returns a third value, `pending`, and shows the asked-for state at once (`useOptimistic` inside the navigation's transition); the DataTable takes `busy` (rows at 60% opacity, `aria-busy`) until the new rows land. A caller that destructures two values is unaffected.
- **Dates and figures reuse their Intl formatters**: `formatDate` and the money and count formatters build their `Intl` formatter once instead of on every call (200 dates: 209 ms to 2.5 ms), which shortens the first tap on Alerts or the drawer on a phone.

### Breaking

Ten changes need a line from anyone updating a project. Each says what to do instead.

- **A nav item carries a required `needs`.** Every item in `src/app.config.ts`'s `nav` writes one: import `FEATURES` and point the item at its feature (`needs: FEATURES.<id>.needs`), or write the `Need` yourself (`'keys:read'`, `{ allOf: [...] }`, `'public'`). `node scripts/check.ts` now fails a malformed one, naming the href.
- **A view tool carries a required `needs`.** An adopter's own view tools declare `needs: FEATURES.<id>.needs` and call `await requireNeed(FEATURES.<id>.needs)` as the first statement of their `read`.
- **A dashboard page that awaits its gate is an async page.** `/`, `/analytics`, `/customers` and `/requests` stream their masthead with the gate rather than in the static shell, and `OverviewPage`/`AnalyticsPage` accept a defaulted props object. A test that asserted the static shell on one of those routes, or code calling a page component synchronously, updates the assertion or the call.
- **`NoAccess` takes a feature, not a title, and is awaited.** `NoAccess({ feature }: { feature: FeatureId })` replaces `NoAccess({ title })`: a caller that passed a title passes a `FeatureId` and awaits it.
- **`SettingsBody` takes a required `may`.** `{ workspaceRead, workspaceUpdate, workspaceRemove }`, computed on the server page from the grant table. A direct caller that passed nothing computes and passes it. A Member or Viewer no longer sees the Workspace section at all.
- **`ConsoleRail` and `ConsolePalette` take the request as a promise.** Both drop `user` and `only` for `access?: Promise<ChromeAccess | null>` — `chromeAccess()` from `src/data/access.ts` — which the layout passes without awaiting and each piece of chrome waits for in its own `<Suspense>` boundary. Pass `access={chromeAccess()}`, or your own promise of the same shape; a console with no sign-in passes none.
- **The demo policy's scope values change.** `subjectId` is a member id, not `'owner'`, and `authorizationKey` is `demo:<id>:<role>:<add-ons deduped and sorted>`, not `demo:1`. Code that hard-coded either reads the scope instead.
- **`ROLES` left `src/data/sample.ts`.** The role table is `src/data/roles.ts` (`MAIN_ROLES`, `ADD_ONS`, `GRANTS`, `whoCan`): an importer takes `MAIN_ROLES` from `@/data/roles`, and a member record now carries `role` and `addOns`.
- **`CUSTOMERS` is no longer re-exported by `src/data/sample.ts`.** Take the twelve rows from `@/system/fixtures/sample-records`, or read the `customers` collection through `read()`.
- **A person may no longer suspend or remove themselves, and the workspace always keeps one active Owner.** The member boundary refuses both — including a status change through `update`, which is new — with its frozen messages. A UI that offered either gets the refusal, and `memberAccess(id).reason` answers the row's own reason.

**An update to 0.13.0 reports one migration.** `nav-needs`: every item in a project's `nav` needs a `needs`, which the rail asks before it draws a destination. `update` names the change and the file it is in, and `--finalize` runs the project's gate, which fails, naming the href, until the change is made — `needs: 'public'` for a page everyone may open, or the page's own feature (`needs: FEATURES.<id>.needs`), as step 4 of the Start guide has it. A project whose `NavItem` type predates this release has to carry the property too. `adopt` writes `needs: 'public'` into the projects it sets up from now on, so only a project that predates this release makes the change by hand.

## [0.12.3] · 2026-10-10

### Fixed

- **The assistant and live-data walk-throughs, and the vitals' taps, reach controls inside web components.** `scripts/assistant.ts`, `scripts/live.ts` and `scripts/vitals.ts` looked for buttons, rows, menus and dialogs in the light DOM only, so on a product whose controls are web components the walk-throughs failed at their first press and vitals measured INP over no tap at all. They now search through open shadow roots with `scripts/lib/deep.ts`, which gains `deepQueryAll`; the live check also looks for a change every 50 ms, since a row a web component draws shows its text without a mutation the page's observer hears, so its timings are now the time to show rather than to the next mutation. Each vitals line ends with `taps: N`. `/deep-tap` pins the tap.
- **A browser suite reads a page once it has loaded.** `open()` in `scripts/lib/chrome.ts` waited a fixed time and for fonts (at most 4 s), so on a busy machine a suite could read a page still loading; it now also waits for the load event, up to 25 s. `/slow-load` pins it.
- **A preset whose values differ by theme holds in a nested scope.** Graphite (and jade in dark) set their lightness with ancestor selectors, which cannot say which theme scope is nearest, so a dark scope inside a light page drew graphite's light values: a dark tile on a dark ground. `tokens.css` now picks them with `@scope`, whose proximity rule makes the nearest theme win; the unscoped rules stay, at one attribute's specificity, for a browser without `@scope`. Regenerate with `pnpm tokens`; nothing to change in a product. `tests/deep-accent-scope.test.ts` renders the fourteen nestings in Chrome.
- **The command palette's field shows that it has focus.** The search band's hairline takes `accent` and its icon `accent-ink` while focus is inside; the audit failed the card without it.
- **A region or key name never breaks at its hyphen.** `keepHyphenated` moved from the Incident card into `@/components/base/text-roles`; the Banner and the Toast use it too, so "eu-central-1" no longer splits after "eu-central-". Tokens over 24 characters still wrap.
- **A narrow table's lead column takes the space it is given.** Under 512px of table the `grow` column takes the slack instead of a third, so a phone no longer cuts a route beside empty space.
- **A disabled Select option is disabled on both lines.** Its description takes `ink-disabled` with its label.
- **The request timeline's first tick reads `0ms`**, through `formatDuration`, like the ticks after it.
- **Every category in a column chart keeps its label**, cut to its column while a column is at least 36px wide; dates still thin out.
- **The assistant says it is working before its first words**: a spinner and "Working on an answer" until text arrives.
- **A narrow metric tile drops its comparison whole** instead of "vs previou…", and its finding wraps instead of being cut.
- **The search pill folds by the top bar's own width** (under 40rem), so a canvas narrowed by the assistant folds it too. The top bar is now a container.
- **A read-only form section keeps its values legible** in `ink-2` instead of `ink-disabled`.
- **A phone's record card reads its facts as one sentence**: the DataTable card is a wrapping row instead of a six-column grid, so a separator dot never lands alone on a line and a fact is never cut to fit a third.
- **Members shows the date its order follows**: Joined appears from 768px of table (Role now drops below 1024px and Team below 1152px), so the newest-first order is explained wherever the table has columns; on a phone the card reads "Joined 01 Oct 2026", in the same form as its "Active 07 Jul 2026" and as API keys' "Created 05 Mar 2026": members joined across two years, so a day without its year would be misread.
- **The Atlas home drops its numbered section labels** (01 to 05), a default Meridian's own register rules out.
- **A figure is never cut.** In a Metric tile or a Featured metric a number longer than nine characters is set at a glance with `fitFigure` ("9.9B", "$1.2M") instead of being clipped by its card; `splitFigure` keeps a compact amount's decimal in the number ("$1.2M", not "$1" and ".2M").
- **A day inside a sentence reads "1 Oct"**: `formatDay` in `src/lib/format-date.ts`; tables and axes keep `formatDate`'s "01 Oct".
- **The colour parser reads `lab()`.** A production build may ship an authored `oklch()` as `lab()`, which `src/lib/color.ts` could not parse; the contrast pairs the gate checks now live in `scripts/lib/contrast-pairs.ts`, so the Atlas measures the same ones.

## [0.12.2] · 2026-10-09

### Fixed

- **A `navigationChecks` control inside a web component is pressable once its page has hydrated.** On a Next page the navigation check counted a control as ready only when the control itself carried React's marker; React never renders into a shadow root, so a control inside one (a design system's input or button) was never ready and the check failed `never-ready`. Readiness is now its rendering host's.

## [0.12.1] · 2026-10-09

### Fixed

- **A web component's button named by its slotted text is no longer reported `unnamed:`.** The audit read a control's name from its own text, which for the native button inside a web component's shadow root leaves out the text slotted into its host, so a labelled design-system button was reported as unnamed. Names now count slotted text (`deepText` in `scripts/lib/deep.ts`), and the presses and the keyboard walk name such controls by it too.
- **The browser checks wait up to 30 s for Chrome to start.** A cold Chrome on a busy machine or runner could take longer than the 12 s they allowed and fail a check with `Chrome did not start`; a Chrome that exits instead is now reported at once, with its exit code.
- **A test may take 30 s.** On a loaded machine or a slow runner a correct jsdom case could pass vitest's default 5 s in the gate's parallel files; `vitest.config.ts` now allows 30 s. A project made before this keeps its own `vitest.config.ts`: add `testTimeout: 30_000` to its `test` block if its gate times out on correct cases.

## [0.12.0] · 2026-10-09

### Added

- **A project can bring its own look.** Meridian's register (dark first, the night-sky neutral, one accent with a job, the defaults that read as generated, and the look-dependent parts of Colour, Typography, Hierarchy and Originality) now lives in its own file, the skill's `references/register.md`. A project with its own design language writes `docs/register.md`, and the skill scores looks and takes brand guidance from it instead. A project register never changes a floor, a required state, accessibility, the loop or the budget policy. `docs/skill-evals.md` gains the scenario that probes it. How it is applied is stated once, in `standard.md`: a line that would lower a floor is not followed but recorded in `out/standard/questions.md`; Meridian's register fills any value the project's leaves unset; the project's anti-defaults and its own brand route replace Meridian's; and its face, radii and colours go through the token files, with any managed file changed for them listed in the keep register.
- **One way into open shadow roots for the browser checks.** `scripts/lib/deep.ts` walks the document and every open shadow root, finds the focused element through them, matches selectors inside them and steps from a slotted element or a root back to its host. Its fixtures live in `scripts/fixtures/deep/` and, with their tests, are not shipped.
- **The audit sees inside open shadow roots.** A product that uses web components had their text, names, targets, contrast and focus rings skipped without a word; the audit now measures them, composites a background through the host, and counts a focus ring only where focus changed the style, so an always-present border is no longer taken for one. A custom element it cannot measure (one with no open root, or one never defined) is reported as `unmeasured:` instead of passing.
- **The presses and the keyboard walk reach controls inside open shadow roots** and name them with their host (`Save (in x-card)`). The walk also presses Shift+Tab back through the stops and reports a reverse order that differs, or a control only Shift+Tab reaches.
- **A project's navigation selectors resolve inside open shadow roots.** `navigationChecks` ready, control and result selectors match elements inside open roots (a descendant combinator still does not cross a boundary), and a control selector that matches several elements prints a one-time `note:` naming the count; the first visible match is pressed, as before.
- **`State` in the Atlas takes `still`.** A specimen that depicts a state (the Focus specimens of Button, Checkbox, IconButton, Input, Switch and AskAbout) is drawn inert, so it is no longer an extra tab stop that never shows focus.
- **The browser checks are documented for web components.** `validation.md` explains `unmeasured:` (a custom element the audit cannot look inside: give it an open shadow root or light-DOM content, or define it) and `note:` (a `navigationChecks` selector that matched several elements: information, never a failure), and lists the keyboard walk's failures, including `reverse order differs` and `never reached … (Tab skips it; only Shift+Tab reaches it)`.

### Changed

- **A focus ring is a change on focus.** The audit and the keyboard walk count a ring only when focusing the control changes its outline, shadow or border (on the control or the frame around it, or anywhere up to its host inside a shadow root). A control whose outline or shadow is always there no longer passes as ringed: give it a ring that appears on focus.

## [0.11.0] · 2026-10-08

### Added

- **The standard the sentence never states.** The skill's `references/standard.md` holds what one sentence leaves out: the register a product UI answers to, the defaults that read as generated, and a scoreboard kept in `out/standard/` for every view. The scoreboard has floors measured by `pnpm verify --full`, and craft judged on renders at 1440 and 390px in both themes (fit, hierarchy, typography, whitespace, colour, motion, responsive, navigation, copy, states, agents, originality). The agent runs the loop until `--full` ends with `the project meets the Meridian standard` and no view is Weak. Mechanical questions it settles itself; judgment calls it records with a recommendation, proceeding when cheap to reverse. Push, release, deploy, production data and the feedback issue wait for a yes.

- **How the skill is evaluated.** `docs/skill-evals.md`: four levels by cost (static checks every change; decision probes, an agent reading the skill in a scenario's folder and stopping before the first write, for a change to the route, the decisions or the standard; planted defects for a change to the loop; end to end weekly), seven scenarios with what a right answer does, and how a finding is counted. Two fixture apps for them in `cli/test/`: `fixture-crumb-ops` (Next.js App Router over its own orders API, with server actions that delete) and `fixture-vite-rota` (Vite and React Router, one browser read); neither ships.

- **One protagonist is a rule, not only a judgement.** `check.ts` fails a file that renders a second `FeaturedMetric`. A planted second one went unscored when an agent judged the renders by eye.
- **The console's rail takes the request's data from the layout.** `ConsoleRail` passes its props through (`user`, `signOut`, `workspace`, `scopes`) and both it and `ConsolePalette` take `only`, the hrefs a person may see. A product filtered `nav` or set its session's person by editing `src/views/console-chrome.tsx`, a file Meridian manages; a console with no sign-in showed the sample person and a Sign out to nowhere. Now the team's own layout passes them.
- **`shot.ts --press "<name>"`** opens a dialog, sheet, menu or popover before the shot, with the mouse, as a person does; repeated, it presses in order. A view that only a press shows can now be rendered and scored.

### Changed

- **An update already on the running version has nothing to do, and says so.** `update` and its dry run print `already at <version>; nothing to update` and exit 0, where they refused with exit 1 as if something were wrong.
- **The sentence ends with its condition, and is meant for `/goal`.** `… to: [what you want]. Done when its hand-over says the Meridian standard is met, or names what only I can decide or provide.` The model a goal uses to check the work reads the sentence and the transcript, never the skill, so the hand-over quotes verify's last line, the coverage line, the scoreboard count, the decisions made, what did not run, and the commits.
- **The skill decides from its drafts instead of asking.** Step 2 turns the homework into recorded decisions; the one question left is the route, when two fit. A brand hue too near a status hue moves to the nearest safe hue, with the brand kept in the logo mark. A missing tool no longer stops the build: what cannot run is reported as not run, and the standard as not yet proven.
- **`skill` prints the path to read.** After installing, it names the `SKILL.md` to read now, since a running agent may not list a skill installed mid-session.

### Fixed

- **What the agents are told about freshness names the right zone.** `freshnessOf` wrote the time in the product's reporting zone and labelled it "UTC", so a product in Asia/Singapore told both agents that 17:30 local was 17:30 UTC. It names `app.timezone`.
- **An amount keeps one precision.** `formatCost` gave two decimals under 1,000 and none above, so a column read "$997.00" over "$1,269"; it gives two at every size ("$1,269.40"). `formatCostCompact` stays for dense tiles.
- **The gate reads an adopted project's imports.** `check.ts` took `@/` to mean `src/`, so in an adopted project, where `@/` is the team's root and Meridian is `@meridian/`, every module imported the documented way read as dormant ("exports X, which nothing a product keeps imports"), and a project had to rewrite its imports as relative paths to pass. It now resolves imports through the project's tsconfig `paths` (`scripts/lib/aliases.ts`).
- **verify reports a bad configuration instead of crashing on it.** An early exit (a `navigationChecks` or `smokeRoutes` entry naming a route that is gone) threw `Cannot access 'suites' before initialization` and hid the reason; it now prints each configuration failure and the coverage line.
- **The coverage line says which suites failed.** A suite that ran and failed was listed under `not run`, as if skipped; it is now `failed: <suites>`, after `not run`.
- **A phone card's status and facts stay in their place.** The status badge took one of the card's six tracks, narrower than a badge at 390px, so it ran left over a long title and sat short of the card's edge; it takes two, as the layout meant. A long fact ends in an ellipsis instead of running over the fact beside it. The sample's customer column caps its width, so a long name no longer pushes the Requests table past its card at 1440px.
- **A product can reach "the project meets the Meridian standard".** The assistant walk-through and the live checks drove the template's own sample pages (Overview, Members, API keys, Settings), so a product that replaced them — every product the skill builds — failed the walk-through or ended `not run: live`, and `--full` could never print the outcome its stop condition asks for. The walk-through now checks what every product shares on its own rail: no agent control while off, on every rail route and embed view, 12 in the template where it was 8; the panel, a reply, the page the model was told, markdown, the thread across navigation, Clear, the layout, a refused key, the key never reaching the browser. It drives each sample page only while its files are there (`scripts/lib/sample.ts`), printing `n/a` with the reason otherwise; Meridian's own repository, which has every one, walks all of them. Without the sample Members page, verify prints `n/a live data` instead of running the live checks, and it no longer counts against the outcome; a product's own live pages prove themselves through `browserChecks`.
- **The skill names what its route needs, from what the probes met.** `create .` works in an empty folder; timezone, currency and the meaning of the request's own terms are recorded decisions; a view's verdict is its lowest criterion; the error state without a fake API is shown by making the read throw for one render. An update already on the running version stops there. The `optional:` and `example:` path prefixes are explained, a project's own copy of the skill is the one to follow, and Route A2 no longer names a `--product` flag `create` does not have. An existing product is learned first, its production addresses found before anything runs, its pages shot "before", and what must survive listed as a floor; Route B renders its "before" from a copy, and a read moved from the browser to the server carries neither cookies nor CORS. `create` and `adopt` end by pointing at the standard, not at `verify` passing. From the second round: the last round needs no round after it; originality comes from how asked-for content is shown, never from adding content; a view's states are scored under it and the shell is one row; the dev server is stopped by its own process id; the rail's signed-in person is never the sample's; an API address overrides `.env` through the environment and is not a `dataUrls` entry; a rebrand that lands near a status hue runs `brand` again with the nearest safe hue. From a built brownfield run and a planted-defect run: an adopted project turns on Cache Components and wraps its shell in `<Suspense>` when detail ids come at request time; a product formatter lives in a file of its own, and a Meridian file it must change goes in the keep register; the theme default is set through `brand --theme`; a navigation probe works at 390px; a request to evaluate only has a route of its own; a criterion not yet judged is not a pass. From the built greenfield run: `create` points at step 3's brief, not step 5; a page specification has a shape to start from; the shared context's 2,400-character budget is stated; the dev server is started as Next itself, so stopping its id stops it. From a third round of decision probes: the existing-project route starts with "Before you change anything", not with `adopt`; Cache Components means `partialPrefetching` too; a render server in a project with a fake API is started with its address; an npm project passes flags after `--`; a currency is evidence of the zone; a browser-fetching app's "before" needs a time budget and a fake API that allows its origin; Route B's new project takes Route A's verify steps.
- **The skill's screenshots reach the dev server.** Step 6 started `pnpm dev`, on port 3000, then ran `scripts/shot.ts`, which reads port 3100. It now starts `pnpm dev --port 3100`.

### Breaking

- **`formatCost` prints cents at every size.** An amount of 1,000 or more reads "$1,269.40" where it read "$1,269". A product that pinned the old string in a test, or laid a column out for the shorter figure, updates it; `formatCostCompact` is the short form.

## [0.10.0] · 2026-10-07

### Added

- **`audit --atlas`.** The browser audit over the Design Atlas: every card's page and its bare preview, at 1440 and 390px in both themes, about ten minutes. Not part of `pnpm verify`, which stays fast (issue #9).
- **`ShareContext`.** `useShareView` as a component that renders nothing, for a server page with no client view (issue #17).
- **A database guide.** `references/existing-project.md` covers a pool that survives a dropped connection, a transaction pooler, schema changes on start, and a role that cannot create (issues #16, #17).
- **`assistant-view-tools` migration.** `update` reports an assistant whose route-side code predates view tools and its limits (issue #17).

### Changed

- **Export is offered on a phone.** The Overview's and Analytics' Export were hidden below 640px; a page's actions are offered on every width (issue #13).
- **`update` sees past import style.** A managed module whose only difference from its release copy is how its imports are written (`@/…` for `../../…`) is untouched, not a merge (issue #16).
- **A specimen is not the page.** The audit keeps a card preview's own headings and scroll regions out of the page's outline and its one scroller (issue #8).
- **A control's role needs its keys.** `scripts/check.ts` fails an element that claims a control's role (`button`, `tab`, `switch` and the rest) with no `onKeyDown` (issue #11).

### Fixed

- **A narrow table becomes cards on any screen.** `DataTable`'s card list follows the table's own width (under 640px), as `hideBelow` does, so a table in a half-width row or beside the assistant's column no longer runs past its frame. Found by the first `audit --atlas`, with the two below.
- **An active filter's label reads.** A filter that is on keeps its name in `ink-2` on the accent tint; `ink-3` fell to 4.04:1 in light.
- **A selected row's facts read on a phone.** On the accent wash, a card's facts step up to `ink-2`; `ink-3` fell to 4.43:1 in light.
- **The presses count a file chooser.** A file picker's button opens the system's chooser, which changes nothing in the DOM; the presses now intercept it and count it as an answer (issue #16).
- **verify's assistant-off run ignores `.env.local`.** It blanks every name the assistant reads, set in the shell or not (issue #16).

### Breaking

- **`Timeline` is removed.** No page used it, and a card exists because a page needs it (`CONTRIBUTING.md`). Import nothing from `src/components/charts/timeline`.

## [0.9.0] · 2026-10-07

### Added

- **Every page tells both agents the same thing (decision 0011).** A view builds one shared context (`src/lib/shared-context.ts`, one producer per page in `src/views/*-context.ts`): its scope and freshness, what the person points at, every figure with its unit, its change and its definition, what code computed from them (`src/lib/insight.ts`: a day against its median, a share, a ranking, a run of days, what nothing recorded explains), and what the data cannot say. An MCP host receives it through `ui/update-model-context`, inline and in fullscreen; the console's assistant receives it in its prompt, with the page's address and query. All nine console pages and the four embed views share one.
- **Every view has a tool.** `src/views/tools.ts` holds each view's contract: its name, its address as input, its `ui://` resource, and one read that returns what it renders and what the agents are told. The console's assistant offers each as a read-only `view_<name>`; `docs/agents.md` registers the same list on an MCP server, with the apply tool of a change registered view-only. The embed routes render from their tool's read.
- **The assistant is told its limits.** Its prompt lists what it cannot do or see, from each collection's `pageOnly`, `hidden` and missing operations, so it can say why.
- **Ask hands a card to the console's assistant.** With the assistant on, Ask appears on the featured card of Overview, Requests, Health and Analytics; a press opens the panel and sends the card's question with the page's context (`ConsoleSurface`). Ask renders only after hydration.
- **An MCP view says when the host refuses.** A refused context is sent once more, and Ask then carries the view's address; a refused Ask tells the person in a toast with the question's words.
- **The person sees the findings.** `MetricTile` takes `finding` (a line, with a day it points the Meridian there) and `baseline` ("2.7× usual" beside a day being read); `TrendChart` takes `baseline`, a dashed median line. The Overview uses all three.
- **An agent's change leaves an Activity line.** The assistant's guard takes an optional `record`; the template writes to a new `activity` collection, and the Overview's Activity is live.
- **The Overview, Analytics and Health read through `read()`.** Daily totals, endpoints, responses, services, incidents and activity are read-only collections (`src/data/metrics.ts`).
- **An address can name a day.** `?day=2026-09-22` opens the Overview pointed at it (`Meridian day`).

### Breaking

`update` reports the two that touch the team's own files as migrations, `share-view-context` and `agent-reads-section`, with what to change (`references/update.md`, "Resolving 0.9.0's migrations"); `src/lib/shared-context.ts`, `src/lib/agent-guidance.ts` and `src/lib/insight.ts` are Meridian's now and arrive with the update.

- `useShareView(text, structured)` is `useShareView(context)`. Build a context with the fields in `SharedContext`; `contextText` writes the text both agents read.
- `scripts/check.ts` requires `### What the agent reads` under `## Agents` in the README of every page under `app/(dashboard)/` and `app/embed/`. Add it to a product's own pages, saying what the page's context tells each agent.
- `src/data/sample.ts` no longer exports `ENDPOINTS`, `STATUS_MIX`, `ACTIVITY`, `INCIDENTS`, `PAST_INCIDENTS`, `SERVICES` or `demoTotals`: read them through `src/data/metrics.ts`. `RequestView` takes `routeP95`.
- `OverviewBody`, `HealthBody` and `AnalyticsBody` take the period key, `updatedAt` and, for the first and last, the incidents and activity beside the figures; `RequestsView` takes `updatedAt` and `now`.

## [0.8.0] · 2026-10-06

### Added

- **A demo password in front of the whole product.** With `DEMO_PASSWORD` set at run time, `proxy.ts` sends every route to the sign-in page (an API answers 401), whose panel becomes "Open the demo": one password field, a 30-day signed session (`src/lib/demo-gate.ts`, keyed by `DEMO_SECRET` when set), and opening the page again signs out. Without it nothing changes: the panel is the product's sign-in and nothing is gated. The sign-in panel now streams in behind a Suspense boundary, so the rest of the page still prerenders. Meridian's own demo deploys to CapRover from this repository (`Dockerfile`, `captain-definition`, neither in the package).

### Changed

- **`update` is tested from the last three releases.** The release updates a project of the release before, adopted and created, through finalize; the weekly run the last three. Every published origin used to run at each release, which took 11 of its 18 minutes and grew with every release. From an older project, update in steps (`references/update.md`).

### Fixed

- **A project leaves an update in progress and each person's agent settings out of git.** Its `.gitignore` (the template's, for a created project; three lines `adopt` adds, for an adopted one) ignores `.meridian/update/` and `.meridian/update.lock`, the staged copies, backups and lock of an unfinished update, which a commit mid-session used to take in; a created project also ignores `.claude/settings.local.json` and `.claude/*.lock`. The manifest, `keep.json`, `.meridian/history/` and both copies of the skill stay committed: the next update and the team's agents read them. In a project made before 0.8.0, add those lines to `.gitignore`.
- **The one sentence shows its blank.** It ended in `<what you want>`, which GitHub and npm read as an HTML tag and dropped, so it read "installs to: .". It ends in `[what you want, in your own words]`.

## [0.7.0] · 2026-10-06

### Changed

- **One sentence for every route, and the skill chooses the command.** The README's sentence is `Run npx zz-meridian@latest skill --global, then follow the zz-meridian skill it installs to: <what you want>`. The skill opens with "Choose the route": a table from what the person said and what is in the folder to `adopt` (this Next.js App Router project, in place), `create` (a new folder, reading any folder named as the source and never writing it) or `update` and `brand`, and it says the route before the first command. The old sentence named `adopt`, which is wrong for a new dashboard.
- **Next.js telemetry is off.** The template's `next.config.ts` sets `NEXT_TELEMETRY_DISABLED` for `next dev` and `next build`, and Meridian's scripts set it for every `next` they run, an adopted project's included. Delete the line in `next.config.ts` to send it.
- **Feedback is an offer, and it identifies no one.** The skill's last step drafts a Bug or a Feature request issue only when the run found something about Meridian, removes every name, address, URL, record, schema and path of the person's own, shows the draft, and files nothing without a yes. The repository has Bug and Feature request issue forms that say the same, and no blank issues. The README and the npm page say what reaches the network (npm, the font download at build, what the team configures) and that an issue is the only way anything reaches Meridian.

## [0.6.1] · 2026-10-06

### Fixed

- **A created project has its `.gitignore`.** npm renames a `.gitignore` inside an installed package to `.npmignore`, so every project made with `create` since 0.3.0 had a `.npmignore` and no `.gitignore`, and `git add` took in `node_modules`, `.next` and `.env.local`. The package now carries the template's as `payload/gitignore`, and `create` writes it as `.gitignore`. In a project created before 0.6.1, run `git mv .npmignore .gitignore`, then `git rm -r --cached node_modules .next` for whatever was committed; `update` leaves the file alone, since it is the team's.
- **`update` runs from the registry.** It compares the running package with the published one, and npm's rename made the two differ, so `npx zz-meridian@<version> update` refused itself with "the running package differs from zz-meridian@<version> on the registry" since 0.5.0. 0.6.0 is on npm with this defect and has no tag or GitHub Release: update with 0.6.1.
- **A gate step whose tool is not installed says so.** `scripts/gate.ts` printed a `TypeError` in place of the missing command.

## [0.6.0] · 2026-10-06

### Changed

- **An API key is shown in full once, when it is created.** The keys collection stores each key's `hint` (its prefix and last four characters, `zzm_live_…f601`) and `secretHash` (the secret's SHA-256), never the secret. `createKey` returns the new key with its `secret` for the creation banner, and the table lists every key by its hint, with no Reveal or Copy. Breaking: `ApiKey` has `hint` and `secretHash` in place of `secret`, and `KeysView`'s `createKey` returns `ApiKey & { secret: string }`. A created project's own keys page and fixtures keep the old shape until the team takes the release's versions.
- **Links are never underlined.** Hover is a colour change and focus is the focus ring every control has. `.link` (accent ink in a sentence) turns `ink` on hover; `.row-link` (a destination in a list) takes `accent-ink`; a Data table's linked row takes the `fill-hover` tint and its title keeps its colour. Before, both classes drew a 1px line across the link's box, which under a link holding a second line read as a rule across its whole width.
- **Replay sends a failed request again.** On a 5xx or 429 request's page, Replay calls `replayRequest` (`app/(dashboard)/requests/[id]/actions.ts`): it authorizes the write, creates a new request with the same method, route, customer, region and model and a `replayOf` naming the original, and refreshes the request reads. A toast names the new request with Open, and its page links back. It used to toast "Replay queued" and send nothing. The requests collection allows `create` as a page-only operation, so the assistant cannot replay. `arrayCollection` takes `derive`, which works out a row's `derived` fields on every create and change. The request page no longer shows a fixed "API key" it did not know. Breaking: `RequestView` takes `replay`.
- **A form in an open sheet says why it failed inside the sheet.** A refused invitation reopens the Members sheet with what was typed and a critical Banner, "Invitation not sent", with the reason. A refused key reads "Key not created" at the top of the Create a key sheet. Neither sends a toast over the sheet's own buttons. Refused changes made from a table row still toast.

### Fixed

- **`update` reads a dependency written as `^24` (or `~5.9`) as a version.** It used to call any range without a minor and patch "a specification Meridian cannot compare". Every created project carries `"@types/node": "^24"`, so each update asked the team to replace `^24` with "at least ^24" before it could complete. A missing minor or patch now counts as 0.

### Release

- **The release's timed default verify allows 180 s on the shared GitHub 4-CPU runner.** The same commit measured 111 s on one runner CPU and 152 s on another, so 120 s stopped a release on the draw of the machine. The default verify must still pass in full; 120 s remains the target on an adopter's own machine. The stakeholder's decision.

## [0.5.0] · 2026-10-06

### Added

- **`pnpm verify` has three modes, and the default is bounded.** The default runs:
  - the gate and one production build;
  - the route policy, and first-load JS against 820 KiB and the per-route baseline;
  - complete HTML against `budgets.htmlKb`;
  - the navigation smoke of at most three routes on desktop and the phone.

  The template's default takes about 70 to 100 seconds on an Apple M5. It ends with one coverage line, `coverage: <mode>; browser <ran|not run (<reason>)>; <n> routes; data configured <a>/<n>; interaction configured <b>/<n>; not run: <suites>`, and writes the detail, including how many times the gate and the build ran, to `out/verify.txt`.
  - `pnpm verify --full` adds every mapped rail route and the exhaustive suites: the audit, every control and link, the keyboard walk, the assistant, live data, Web Vitals and the configured `browserChecks`.
  - The default never refuses for a missing safe backend or Chrome. It runs the static checks and reports the browser as `not run`, while `--full` requires both.
  - `scripts/verify.baseline.json` is the team's first-load baseline. `node scripts/sizes.ts --write-baseline` records it, and `adopt` does not copy it, so an adopted project reports growth as not configured until it records its own.
  - Breaking: `--quick`, `--no-vitals` and `--extra` are gone from `verify` and its scripts. An update reports the `verify-modes` migration for a team `package.json`, workflow or shell script that still passes them.
  - `pnpm verify --perf` runs every mapped rail route on desktop and the phone, warm, cold (a fresh browser, with no destination prefetch) and right after a live refresh. It takes 20 samples each, reports the nearest-rank p95, median and max against the budgets, and marks a p95 over its budget as `warn`, never a failure. Warm samples start from the rail route before the destination, after its prefetch and the chunks it brings have landed. `--full --perf` runs the gate and the build once for both.
  - The live check's burst case reports the second tab's requests by kind: refresh actions, router refreshes and prefetches.
- **Every console route's loading state shows the page's own heading.** A navigation that commits the loading state first acknowledges the page at once instead of after React's 300 ms reveal throttle: `/members` on the phone went from a bimodal 60 or 330 ms to about 30 ms. The Atlas guides moved to routes of their own, so opening one no longer downloads the card and token stages; the URLs are unchanged.
- **The console shows a page's title at once on navigation.** `/`, `/analytics` and `/requests` render their masthead outside the boundary of their address-dependent data, so a warm navigation shows the heading in about 30 ms instead of 230 to 430 ms. `/requests`' HTML cap is 150 KiB for this; it is 143 KiB, and 22 KiB compressed.
- **`/requests` pages, sorts and filters on the server, and exports from an authorized route.**
  - The page sends 20 rows, the total and a server-computed summary for the address, and an invalid filter falls back to its default.
  - `GET /api/export/requests?<filters>` streams the whole authorized filtered set as CSV, in batches of at most 100 rows, and stops when the download is cancelled. It answers 401 without a session.
  - `src/lib/csv.ts` writes a text value that starts with `=`, `+`, `-`, `@`, a tab or a carriage return so a spreadsheet reads it as text, and gains `csvHeader` and `csvRow`.
  - `ExportButton` gains `href`, a download link to a server export.
  - Breaking: `filterRequests` is removed. `RequestsView` takes `{ rows, total, summary, state, pageSize }` and renders the tiles and the table only. The page renders the masthead, with freshness and export in boundaries of their own.
- **Each uptime strip is one SVG.** It draws a baseline and a mark per degraded, outage or no-data day. Its accessible summary names the period and only the days that were not fully up, instead of a table of every day. `DayState` gains `'none'`, which reads "No data". The per-day elements and the hidden table are gone.
- **`scripts/navigate.ts`: the navigation smoke.** For each selected route, on desktop and through the real 390 drawer at 4× CPU, 150 ms latency and 1.6 Mbps, it measures:
  - the shell;
  - the data, from the route's `readySelector`;
  - the interaction, from its harmless probe.

  It applies the median retake rule and checks prefetch bytes against the desktop and closed-drawer caps. A route without a mapping reports its data and interaction as `not-configured`. `scripts/verify.config.ts` gains `budgets`, `navigationChecks` and `smokeRoutes`, and the template maps every rail route.
- **The verification measurement library** (`scripts/lib/timing.ts`, `sizes.ts`, `coverage.ts` and `budgets.ts`) holds:
  - the median retake rule and nearest-rank p95;
  - the first-load, HTML and prefetch caps, and the default budgets;
  - smoke route selection and coverage resolution.
- **`pnpm verify` checks live data end to end.** After the browser checks, `scripts/live.ts` drives two tabs on `/members` against the built app:
  - an invitation in one tab shows in the other within 2 s;
  - with change hints dropped (a second server with `LIVE_DROP_HINTS=1`), after a server restart, a hidden tab shown again and a tab back online, the other tab still converges within the safety poll plus 2 s;
  - a burst of 20 invitations in 2 s arrives with at most one refresh in flight.

  It prints each measured time and removes the members it invited. A project without a live `/members` page sees each case as `not run`, with the reason.
- **An update to 0.5.0 reports this release's migrations.** It names the team-owned files that still have the old shape:
  - `shell-assistant-promise`, `assistant-available-promise`, `clock-now-required` and `cache-components-config`;
  - `connection-boundaries`, `authorized-read`, `scoped-invalidation`, `live-provider` and `authorized-endpoints`;
  - `verify-modes`, for a script, workflow or shell file that still passes a removed `verify` flag.

  Each says which section to follow, and is checked by the gate and a build (`verify-modes` by the gate). A product already on the new shape gets no line. The skill gains `references/cache.md` and `references/live.md`. They carry every team-owned starter verbatim: `access.ts`, `read.ts`, `live-stream.ts`, `live-actions.ts` and `/api/live`. They also hold working-shape Postgres LISTEN/NOTIFY and Redis pub/sub adapters, and say plainly that the sample is a single process, and that polling cannot reconcile stores that diverged.
- **Live data in the console: one stream per tab, and a refresh that reauthorizes.**
  - `src/lib/live.ts`, now managed, holds `createLiveClient` (the framework-free scheduler) and `LiveProvider` and `useLive`, which put it in a React tree. Every hook in a tab shares one `EventSource` for the union of the collections they show.
  - Hints wait at most 500 ms, one refresh runs at a time, and what arrives meanwhile runs next. A safety refresh runs every `pollMs` (30 s) even on a healthy stream, and a refresh slower than 10 s counts as failed.
  - A failed connection is retried after a second. After the third failure the tab polls, and tries the stream again on every fifth poll. An authorization failure pauses it, and any other failure leaves it `stale` without advancing the data's observation time. A hidden tab closes its stream, and showing it again resyncs.
  - The team-owned `src/data/live-actions.ts` exports `refreshCollections(names)`, a Server Action that invalidates only the collections the caller may read. `src/views/console-live.tsx` injects it into the provider, followed by a router refresh. The dashboard layout wraps every console page in it without waiting for the request, and Members and Keys call `useLive`.
- **`GET /api/live?collections=members,keys`: change hints over Server-Sent Events.** The team-owned starters `app/api/live/route.ts` and `src/data/live-stream.ts` open with `retry: 3000` and a `resync`, send a `change` naming only the collection, and beat every 15 seconds. Each hint is sent only after the caller's scope is checked again, and a scope that may no longer read ends the stream. A malformed, empty or oversized request (more than 50 names) gets 400, no session 401, and an unknown or forbidden name 403 without saying which. No record, tenant or cache tag reaches the browser.
- **`zz-meridian update`: a real, reviewable update.** For a project adopted or created with 0.3.0 or later.
  - `--dry-run` replays the recorded release in a scratch folder, after checking it against the registry's integrity record, and prints the plan. It writes nothing, and refuses if any recorded file disagrees with the replay.
  - A plain `update` replaces every Meridian file the team has not touched, adds the new ones and removes retired ones. Files the team edited, deleted or kept are staged as base/ours/new copies, never overwritten.
  - It adds the dependencies and scripts the release needs to `package.json`. An entry still exactly as the earlier release wrote it follows the new release; one the team chose becomes a migration. It updates Meridian's managed block in `AGENTS.md`.
  - Every run writes `.meridian/update/<version>/` with a journal, `MERGE.md` and `resolutions.json`, even when nothing is staged.
  - It refuses, writing nothing, on a dirty tree (unless `--allow-dirty`), an open session or a left-behind lock, a bad manifest or keep entry, or an unsafe path.
  - The default output lists only what needs a decision; `--verbose` lists every file.
  - `update --finalize` checks every resolution against the current files, confirms the installed framework versions, then runs the gate and one production build in place. Only then does it record the new version and archive the report to `.meridian/history/`. A check that changes a source file fails the session and leaves the bytes alone. The browser checks stay a separate `verify`.
  - `update --finalize --verify` runs the project's default `verify` once, in place of the gate and the build, so nothing runs twice. It prints and records verify's coverage line (`MERGE.md` gains a `Coverage:` line), and a failing verify fails the session as a failing gate does.
  - `update --resume` continues an interrupted or failed run without overwriting a later edit. `update --abort` restores only what the update changed, and refuses when a file it wrote was edited since.
  - An update with nothing to resolve finalizes in the same command.
- **`zz-meridian brand [brand flags]`: rebrand with no hand edits.** The brand outputs, `src/app.config.ts` and the manifest change together, or nothing changes. It refuses when a brand output was edited or an update is open.
  - The package version is now 0.5.0.
- **`.meridian/keep.json`, the update session and `app.logo` are checked by the gate.**
  - `keep.json` is a list of `{ path, reason }` entries: Meridian files the team deliberately keeps as they are. `node scripts/check.ts` fails on an entry for a file Meridian never managed, a duplicate, a blank reason, or a kept file that is missing.
  - While an update session is open under `.meridian/update/`, the gate fails until every staged file and migration has a current resolution. Once it does, the gate checks against the files the update will own.
  - `app.logo`, when set, must be a root-relative SVG under `public/`, such as `/logo.svg`.
  - The gate's lint step leaves `.meridian/` alone, since a session keeps copies of files there for reading.
- **`--theme dark|light` and `app.logo`.**
  - `brand.ts --theme` sets the default theme in `src/app.config.ts`, applied before the first paint until a person picks one.
  - `app.logo: '/logo.svg'` shows your SVG from `public/` in the mark at 20, 24, 28 and 32 pixels. Beside the product name its `alt` is empty, and on its own `AppMark` takes a `label`.

### Changed

- **`refreshCollections` reports a missing session as a value.** It resolves `{ ok: true }`, or `{ ok: false, status: 401 }` when there is no session, because a thrown error loses its status in a production build. `ConsoleLive` turns the refusal into the 401 the live client pauses on. Breaking: a caller reads the result instead of catching.
- **Lighter pages, rendered the same.**
  - Tables state their cell classes once, at the table, instead of on every cell.
  - The Health page sends each service's 90 days as one character a day.
  - The rail keys its link styles on `aria-current`.
  - `/requests` is 143 KiB and `/health` 99.6 KiB, from 155 and 119. Screenshots at 1440 and 390, in dark and light, are identical.
- **`brand.ts --no-atlas` and `--product` also remove the Atlas's routes from `scripts/verify.config.ts`.** A created project's `verify --full` no longer fails on navigation checks for pages it does not have.
- **The Atlas preview route loads only the card it shows.** Its first-load JS fell from 1441 KiB to 591 KiB. `scripts/registry.ts` also writes `src/system/preview-loaders.ts` and the preview route's key list, and `brand.ts --no-atlas` removes both.
- **The template builds under Cache Components, and every non-API route is static or partial.**
  - `next.config.ts` turns on `cacheComponents` and `partialPrefetching`. The console layout no longer waits for the request: it hands the shell a promise of whether the assistant is configured.
  - Breaking: `AppShell`'s `assistant` is a `Promise<boolean>`, and `useAssistantAvailable()` returns that promise. Read it with `use()` inside a `Suspense` boundary. The launcher keeps its place, inert and hidden from assistive technology, until the promise resolves `true`.
  - The not-found page prerenders its sentence and links. The address that was asked for streams in behind its own boundary, at the size of its placeholder.
  - Every console route has its own route-shaped `loading.tsx`. The Overview page moved to `app/(dashboard)/(overview)/` (same URL), and the shared `app/(dashboard)/loading.tsx` is gone.
  - `pnpm verify` runs `node scripts/route-policy.ts` after its production build. It fails any non-API route that is neither static nor partial, unless `scripts/verify.config.ts` declares it in `requestDependentRoutes` with a reason.
  - In the template, `node scripts/check.ts` fails on a `connection()` call outside the console layout and the not-found page. A product's own pages are its own, so the rule is silent once `.meridian/manifest.json` exists.
- **Pages read through an authorized, scoped and cached `read()`, and writes invalidate exactly their tenant's collection.**
  - `src/data/access.ts` (`resolveAccess`, `collectionFor`, `can`) says who the request is and what it may do. The sample binds one tenant and one owner; a product replaces the policy with its session and database predicates.
  - `src/data/read.ts` exports `read(name, query)`, which refuses a collection the caller may not read before any cached code runs. It caches per scope and query with the profile `{ stale: 30, revalidate: 60, expire: 3600 }`, tags the tenant's collection as `collection:<sha256>`, and returns the time the read ran as `observedAt`.
  - The members and keys pages read through `read()` and no longer call `connection()`. Their actions authorize the operation and every record they touch, write through the caller's own collection, and call `updateTag` only after the commit.
  - Breaking: `src/lib/collection.ts` is now Meridian's, and `adopt` adds `zod`. `Query` gains `offset`, and `normalizeQuery` defaults and caps it, rejects unknown fields and operators, and sorts by the key last. A `Collection` may `subscribe`; `arrayCollection` takes a `tenantId`, with a store and listeners of its own.
- **An approved assistant change is authorized again when it runs.**
  - The assistant route resolves access before the model is reached (401 without a session) and hands the assistant only the caller's own collections that they may read.
  - Each approved create, update or remove asks the route's guard with the records it touches, at the moment it runs. A permission revoked since the approval refuses it with "You no longer have permission to make this change." and changes, emits and invalidates nothing. A committed change drops its tenant's cached reads with `revalidateTag(tag, { expire: 0 })`.
  - Breaking: `assistantTools(collections, writer, guard)` and `respond({ …, guard })` take the guard.
- **Pages and views read only through `src/data`.** The requests pages read the `requests` collection with `read()` and format against its `observedAt`. Everything else the sample pages draw comes from `src/data/sample.ts`. In the template, `node scripts/check.ts` fails on a page or view that imports `src/system/fixtures` directly, by alias or relative path, and on `'max'` as the revalidation profile on a writer path (actions, API routes, the assistant, `src/data/live-actions.ts`). Both rules are silent once `.meridian/manifest.json` exists.
- **Members and keys update optimistically.** An invitation shows first in the table at once, marked "Saving…"; a status change, a removal or a revoke shows at once too. A refused change puts the table back and toasts "Change not made" with the reason, and a row with a change in flight takes no second one. The freshness the views show stays the read's observation time. Breaking: `KeysView` takes `now`, the read's `observedAt`.
- **Breaking: the clock is always the caller's.** `formatRelative`, `Freshness`, `ShellTools` and `AlertsPanel` take a required `now`, the data's clock; none of them reads the browser's clock any more.
- **One rule says which files are Meridian's.**
  - `cli/src/ownership.ts` decides it for `adopt`, `create` and `update`; `references/ownership.md` in the skill is the same rule, rendered.
  - Meridian's files are its tokens, styles, components, scripts (except `scripts/verify.config.ts`, `scripts/verify.baseline.json` and a `scripts/check.local.ts`), its library helpers, `src/views/console-chrome.tsx`, `tests/setup.ts`, the brand outputs and both skill copies. Everything else is the team's, including a file the team adds inside one of Meridian's folders.
  - Breaking: a new `.meridian/manifest.json` records only those files. `src/app.config.ts`, `scripts/verify.config.ts`, pages, views, data and docs are no longer in it, and a created project's manifest no longer lists every file. An update treats such entries in an older manifest as the team's and never deletes them.
  - The manifest records one accent choice: `--hex` wins over `--hue`/`--chroma`, which win over `--accent`.
- **The gate's dormant-export rule leaves Meridian's managed modules alone in every project built on Meridian.** Before, only adopted projects were exempt. A created project then failed its gate whenever a release added an export its own code did not use yet.
- **Branding no longer edits `src/lib/preferences.ts`.** Breaking: `ACCENTS` is the four presets plus `app.accent` when it names another, so a custom accent is set in `src/app.config.ts` alone; `brand.ts --hex` or `--hue` does that for you.
- **The gate checks the agent context.**
  - `node scripts/check.ts` fails when `docs/brief.md` lacks one of its five sections, and warns while a section still holds only its template line.
  - It scans the managed block in `AGENTS.md`, the installed skill and the brief. It fails on any path or package script they name that does not exist; `optional:` and `example:` references are allowed to be absent.
  - The skill's references are labelled to match: they hold in the template, in an adopted project and in a created one.
  - The skill carries its own `references/voice.md`, `references/agents.md` and `references/update.md`, so a created project, which has no `docs/`, no longer points at files it lacks.
- **The package no longer ships the CLI's own tests into a new dashboard.** They import `cli/src`, which a project never has, so the created project failed its own type check.
- **`AGENTS.md` gets a managed block, not an appended section.**
  - `adopt` and `create` write Meridian's rules between `<!-- BEGIN:zz-meridian-agent-rules -->` and `<!-- END:zz-meridian-agent-rules -->`. The rules name your package manager's commands, and every byte of your own text around them is kept.
  - Breaking: `scripts/brand.ts --existing` no longer appends `# Built on ZZ Meridian`, and `--product` no longer writes `# Working in this dashboard`. The CLI writes the block instead. Run `adopt` or `create`, or, once it is out, `update`, rather than `brand.ts`, to get it.
- **`docs/brief.md`: the team's own context.**
  - `adopt` and `create` write a five-section brief (Product, Users, Data, Decisions, Glossary) when there is none, and never overwrite one.
  - The template's assistant reads its Product, Users and Glossary sections, at most 2000 characters, as context and never as instructions.
- **`brand.ts --product` keeps the assistant's build tracing.** It removes only the Atlas's `/system/**` entry from `outputFileTracingIncludes`.
- **`adopt` refuses an incomplete package before it writes anything.** Its copy rule now lives in `cli/src/ownership.ts`, shared with `update`. A package whose template lacks a file adopt needs is refused first; before, that failure surfaced as a crash halfway through.

### Fixed

- **`pnpm verify --full` no longer counts a suite that ran nothing as run.** The live-data check exits 2 when a case did not run, for example in a product without the template's live `/members`. `verify` then reports `not run` for it, keeps `live` in the coverage line's not-run list, and ends with `every check that ran passed; not run: live`, not "the project meets the Meridian standard". Breaking: a script that matched the old closing line reads the coverage line instead.
- **The size and route checks work with any Next config file.** `scripts/route-policy.ts` and `scripts/sizes.ts` read the build folder from `next.config.js`, `.mjs`, `.ts` or `.mts`, as Next does. Before, an adopted project whose config was not `next.config.ts` failed both with a missing-module error.
- **Pages with no data show an empty state, not an error.** Overview, Analytics, Health and Customers render their empty card when their series are empty. `/customers` renders its title in the first HTML, and the page skeletons announce themselves as loading to assistive technology.
- **A failed invitation is told, even when the request never reached the server.** The members page rolls the row back and toasts "Change not made" for a dropped connection too.
- **Creating an API key requires at least one declared scope.** The server refuses an empty set or an unknown scope, and Create stays disabled until a scope is ticked.
- **Undo after Disconnect puts the host back where it was**, once.
- **The embed's "Set by Claude" can be cleared.** Breaking: a person's change writes `by=you` in the address, where it used to remove `by`.
- **`brand.ts` writes brand values literally**, so a name containing `$&` stays as typed. With `--existing`, `--package` renames the package and keeps its version and description.
- **Interrupted checks clean up after themselves.** `verify`, the live check and the consumer smoke stop the servers, suites and headless Chrome they started, and remove their scratch folders, when they are interrupted or fail.
- **The documented Postgres live adapter opens one listening connection**, however many collections subscribe at once.

## [0.4.0] · 2026-10-05

A quality pass over the whole repository, and a manual pass through the running product — every page, embed, Atlas
view, CLI command and API route, at both widths and both themes. Twenty-two defects fixed, six of them found only by
auditing the Atlas, which nothing had done before. Both field reports on #6 and #7 are in.

### Security

- **The markdown URL policy could be bypassed with a control character** (`src/lib/safe-markdown.ts`). The scheme was read from the raw string, but a browser removes tab, newline and the other controls from a URL before it reads one: `java\tscript:alert(1)` IS `javascript:` to the browser, so a link an agent, a document or a note wrote could reach a script — the one thing this module exists to stop. The scheme is now read from a copy with the controls and spaces taken out, and only the probe is stripped: a URL that passes is returned exactly as written. `tests/prose.test.tsx` covers the obfuscated forms.

### Fixed

- **`scripts/keyboard.ts` could fail a page that was right.** It judged a focused control two frames after the key event, and the skip link is drawn off the top edge until `:focus-visible` moves it in — so a measurement taken in between clamped to the page's corner, found the sticky bar there, and reported `hidden under div.flex.h-16: Skip to content`. That failed the `gates` job of the 0.4.0 release, on `/keys`, while the same page passed here and in the dry run: a race, not a covered control. It now takes a second look 150 ms later before calling a control covered, which a control genuinely under something cannot pass.
- **`scripts/keyboard.ts` failed a page that was right.** Its control selector asked for `button:not([disabled])`, `input:not([disabled])` and so on — the *attribute*, which only a control's own markup carries — so a control disabled by a `<fieldset disabled>` was counted as one the keyboard should reach, and Tab (which correctly skips it) never arrived. A `FormSection` in its read-only or saving state is exactly that, so its Atlas page and its preview both failed with "never reached: INPUT" — a check crying wolf on the component it ships. The selector asks for the state now (`:disabled`), which is what the audit's own target check already did. Both routes pass; reverting the selector fails them again.
- **The assistant's whole panel was in every page's first load** (issue #7). `AppShell` loaded `AssistantColumn` *and* `AssistantLauncher` through `dynamic(() => import('@/components/patterns/assistant'))` — the same barrel — so the chunk a page fetched to draw its launcher button carried `useChat`, the AI SDK's client and its zod schemas, `react-markdown`, `remark-gfm` and `micromark`: 448 KB in the reporting product's build, on every page, whether or not anybody opened the panel. The launcher is its own module now (`assistant/launcher.tsx`, which imports only the Agent Mark), and the column mounts the first time the panel is opened and stays mounted after, so the thread still survives closing and reopening. The measurement, from the report: 1,152-1,219 KB of JS per page before, 696-761 KB after, with 456 KB arriving on the first open.
- **`verify`'s "assistant off" start could be turned back on by `.env.local`** (issue #7). It deleted every `ASSISTANT_*` variable from the environment it passed on, but `next start` loads `.env.local` itself and Next does not overwrite a variable that is already set — so a person keeping their own model there got "/ has 1 assistant element(s)" while nothing was wrong. The variables are blanked instead, which is what `assistantConfig` reads as unset.
- **Nothing checked what a page actually downloads.** `vitals.ts` measures LCP, INP and CLS, and all three stayed green while the panel's chunk rode along on every page. `scripts/assistant.ts` measures the split directly: it lists the page's scripts with the panel closed, opens the panel, and fails when opening it fetched no script the closed page lacked — which is exactly what "the launcher carries the panel" looks like from the browser.
- **The guides said nothing about reading a table once per request** (issue #7). A console page asks for the same records from several places — the shell tools, a page strip, the page and its freshness stamp — which is free over the sample's fixtures and a round trip each over a network. `src/data/collections.ts`'s header, `references/customize.md` and `references/existing-project.md` now say to wrap the read in `cache()` from `react`, to keep the write path reading directly so validation never sees an earlier answer, and to raise `pg`'s ten-second idle timeout. The reporting product's three heaviest pages answered 44-46% sooner for the first.
- **A DataTable drew both of its layouts on every render** (issue #6). The component rendered the table *and* a `<ul>` of the same records, and let CSS hide one: every cell function ran twice on mount and again on every filter, sort or page change, both trees reached the DOM at every viewport, and each device downloaded a tree it could never show — on the reporting product's `/activity` that was 201 of 711 elements hidden and unusable. It draws one tree now: the real `<table>` at every width, its rows laid out as cards below 768px in CSS. Each cell carries `data-mobile` — `check`, `title`, `status`, `fact` or `hidden` — naming its part of the card, and the row becomes a six-column grid. Nothing is measured, so there is no hydration swap and no flash: a phone gets the card in the server's HTML exactly as before. A column the table dropped for width (`hideBelow`) comes back in the card, which is what the old list did. The only render left over is the phone wording for a column that declares `mobileCell` ("Used 1 min ago" beside "1 min ago") — a few words, never a second copy of the row. `tests/data-table.test.tsx` holds it.
- **Two tabs of the same dashboard disagreed about the theme, accent and density** (`Providers`). The stored choice was read once on mount and never again, so a person who switched to the light theme in one tab kept the dark one in the other until it reloaded. `Providers` now follows the `storage` event, which fires only in the tabs that did not write — exactly the ones that need it. `tests/preferences.test.tsx` holds it (and fails without the listener).
- **`Sparkline` drew a stray filled triangle for fewer than two values.** `Math.min()`/`Math.max()` over an empty array give ±Infinity, and the area path closed with them; the README promised "under two values, render nothing". It renders nothing now, and `tests/sparkline.test.tsx` holds it — with the guard removed it fails on exactly the degenerate path (`d="L120,36L0,36Z"`), which a real ResizeObserver would have drawn.
- **`formatCompact` rendered a negative in full** — `formatCompact(-1_500_000)` was "-1,500,000" in a tile while an axis rendered the same number as "-1.5M". Every branch turns on the magnitude now, as the axis formatter already did.
- **`FeaturedMetric` crashed on a figure its splitter did not recognise.** `text.match(...)` was dereferenced without a null test, so a formatter returning "—", a negative, or any currency symbol other than `$`/`€`/`£` threw. Both it and `MetricTile` now share one total parser, `splitFigure` in `src/lib/format.ts`, which never fails to match.
- **The MCP Apps host bridge never removed its `window` listener.** `HostBridge.dispose()` releases it, and `EmbedSurface` calls it on unmount — a bridge that is never disposed keeps its listener, and everything it closes over, alive for the life of the page. `tests/agents.test.tsx` holds it twice over: that a disposed bridge delivers nothing to its listeners, and that the handler it added to `window` is the one it takes off (the second is what catches the leak — the first passes on `listeners.clear()` alone).
- **`scripts/brand.ts` silently did nothing for part of a new accent.** It patched an `ACCENT_SWATCH` map that no longer exists in `src/lib/preferences.ts`; a `String.replace` with no match writes nothing. Removed.
- **`scripts/keyboard.ts` ignored `--extra`.** `pnpm verify --extra /orders/1` walked the configured detail pages here while the audit, the presses and vitals walked the ones that were asked for.
- **`scripts/verify.ts` looked for the assistant only in `app/`.** A project that keeps its routes under `src/app` — which `adopt` supports, and which `APP_DIR` already models — would have had its whole assistant walk-through skipped, silently.
- **`scripts/fake-llm.ts` used the older entry-point guard** while every other script uses `import.meta.main`.
- **`app/(dashboard)/keys/actions.ts` stamped every key's owner as "Maya Chen"** instead of the product's own person (`app.user.name`).
- **The Atlas did not list the Members page.** `/system/pages/members` did not exist, so the page's own specification was unreachable from the Atlas; `docs/surfaces.md`'s page inventory omitted Members and API keys.
- **`next.config.ts` did not trace `app/**/*.md` for `/system`.** The Atlas reads its page specifications from `app/`, and today those routes are static — a runtime render would have read them as empty.
- **`docs/surfaces.md`'s page inventory named two embed views that do not exist** (`request`, `customer`) and left out the one that does (`/embed/proposal`). Every page's own specification already said "not offered" for those two; the table agrees with them now and lists the proposal view. The same guide credited the token bridge to `EmbedFrame`; `EmbedSurface` is what applies it, on every embed route. `check.ts` has a rule now, so this cannot drift again: every `/embed/<name>` a document writes is a route, and every view the inventory's own column offers is one.
- **Twenty-four sizes written into the specifications were the tokens' old values.** The radius scale was retuned (4/6/8/12/16 to 5/8/10/16/24), the control heights with it (30/36/44 to 32/38/46) and the row height (36/48 to 38/52), and eighteen specifications kept the old numbers: Banner, Button, Card, Dialog, Icon button, Input, Menu, Pagination, Popover, Segmented, Select, Skeleton, Table, Textarea, Toast, Tooltip, Export button and `docs/surfaces.md`. A product sizing a corner, a control or a row from the specs — the card contract is what CONTRIBUTING points a reader to — was a few pixels out, and nothing said so. `check.ts` has a rule now: a token annotated with a px value must be that value, comfortable or compact, and a token whose own value is not a plain px (a clamp, a var) is left alone.
- **Four controls were under 44px on a phone**, which the standard requires of every control on a coarse pointer (`.hit` gives a control a 44px target; its siblings already carried it). The Appearance menu's trigger (`size-8`), the alerts panel's "Mark all read" and the filter bar's phone-only "Clear" — text buttons, which the box-link rule never covered — and `AskAbout`'s button (`h-7`). Nothing caught them because the audit only measures a control when it is on screen, and on a product page these live in a closed drawer, popover or sheet: the components' own previews, which nothing audited, are where they showed.
- **The App Mark preview drew its light specimen as light text on a light ground** (1.05:1 — the audit fails that contrast). `data-theme` redefines the variables in its own scope, but `color` had already been resolved on `body` from the page's theme; the Planes preview carries `text-ink` for exactly this reason and the App Mark preview did not.
- **The Motion preview demonstrated `.link` as a box control.** `.link` is a link inside a sentence — that is why it is exempt from the 44px rule — and shown bare in a flex row it blockifies, losing both the exemption and the box-link hit area, so the specimen stood for a control the class is not. A box link is `.link inline-flex`, as the Atlas's own links are.

### Changed

- **One parser splits both figures.** `FeaturedMetric` had its own regex with a hard-coded `$€£`; it and `MetricTile` share `splitFigure` now, which is total and takes any leading symbol.
- **The card's interactive hover is the shadow its own spec, preview and token catalogue name** (`shadow-raise`, "an interactive card under the pointer") — the code had used `shadow-halo`, which belongs to the featured card.
- **The button's hover documentation matches the button**: a 5% brightness step over `dur-hover`, because the fill is a gradient image that a colour change cannot show through. The README and the preview said `accent-hover`.
- **The Sheet's close fade and the token catalogue's growing bar use the duration tokens they had written as literals.** The sheet's leave faded over a hard-coded `160ms` — the *hover* duration — while its own scrim and every other overlay going away use `--dur-exit`; it does now too, so a sheet and the scrim under it finish together. `token-view.tsx`'s bar grew over `900ms`; it uses `--dur-grow`. `docs/surfaces.md`'s token bridge lists `surface-raised` and `radius-md`, which the bridge has always mapped.

### Removed

- **`.sheet-right-in`, `.sheet-up-in` and the `m-sheet-right` keyframe** from `motion.css`: nothing referenced them, and the Sheet animates inline (its README claimed motion.css had no right-edge keyframe; it did).
- **`PopoverAnchor`**, exported and named nowhere (the preview uses `PopoverClose`, which stays; the README now names it).
- **Dormant exports**: `ROOT`/`Token`/`BRIDGE`/`buildCss`/`buildTheme` in `scripts/tokens.ts`, `PAIRS`/`context`/`resolve`/`colorOf` in `scripts/contrast.ts`, `LAYERS`/`CardEntry` in `scripts/registry.ts`, `VerifyConfig` in `scripts/verify.config.ts`, `adoptSet` in `cli/src/adopt.ts`, and the Atlas's internal types (`TOKEN_VIEWS`, `DOCS`, `parseSpec`, `SectionId`, `Entry`, `slug`, `HostSimulator`, `Card`, `TokenMeta`).
- **The `rail-collapsed` token**: declared since the first commit, referenced by no component, spec, bridge or script.
- **`DEMO_STALE_AFTER_MS`** (and the unused `Customer`/`StatusClass` type exports): nothing imported them.

### Breaking

- **The `rail-collapsed` token is gone** (`tokens/core.tokens.json`, and `src/styles/tokens.css` with it). Nothing a
  product keeps referenced it — no component, specification, bridge or script — so a stylesheet of your own that reads
  `var(--rail-collapsed)` was already falling back to nothing. The rail's width is `rail-width`; below 1024px it is a
  drawer, which is not a collapsed rail.
- **Dormant exports removed from Meridian's own scripts**: `ROOT`, `Token`, `BRIDGE`, `buildCss` and `buildTheme` in
  `scripts/tokens.ts`; `PAIRS`, `context`, `resolve` and `colorOf` in `scripts/contrast.ts`; `LAYERS` and `CardEntry` in
  `scripts/registry.ts`; `VerifyConfig` in `scripts/verify.config.ts`; `adoptSet` in `cli/src/adopt.ts`; and the Atlas's
  internal types. A product that imported one of these was reaching into a generator; nothing that ships depends on
  them.
- **`PopoverAnchor` is gone**, and `.sheet-right-in`/`.sheet-up-in` with the `m-sheet-right` keyframe. The first was
  exported and named nowhere; the others were referenced by nothing, and the Sheet animates inline.
- **`DEMO_STALE_AFTER_MS`** and the unused `Customer`/`StatusClass` type exports are gone from the sample fixtures.

Nothing a product renders changes shape because of any of this: `pnpm gate` proves that every export of `src/lib` and
`src/data` is imported by a file a product keeps, and it passes.
```

