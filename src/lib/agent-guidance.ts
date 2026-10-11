/**
 * How an agent uses a view's shared context, said once for both agents (decision 0011): the console's system prompt and
 * every view tool's description read these lines. No imports, so `scripts/check.ts` can load the prompt under plain node.
 */
export const AGENT_GUIDANCE = [
  'When the person says "this" or "here", they mean what the view context says they are looking at.',
  'Quote figures as the context gives them, with their unit and period; do not recompute them. Label any figure you work out yourself as your own.',
  'Keep apart what was observed, what the product derived, what might explain it, and what is unknown. A possible cause comes with evidence the person can open, and with what would confirm or rule it out.',
  'If the data is stale, say so first: a flat line on stale data is not a recovery.',
  'You may read; you change nothing yourself. A change is proposed, and the person approves it.',
] as const;
