'use client';

import { AgentMark } from '../../ui/agent-mark/index';

/**
 * The top-bar button that opens and closes the panel.
 *
 * ITS OWN MODULE ON PURPOSE. This is the one part of the assistant a page draws while the panel is closed, and it must
 * not carry the panel with it: `index.tsx` pulls in `@ai-sdk/react`'s `useChat`, the AI SDK's client and zod schemas,
 * `react-markdown`, `remark-gfm` and `micromark` — 448 KB in one adopter's build (issue #7) — and the shell loads this
 * module on every page. Split out, the button costs the mark it draws and nothing else; the panel's chunk arrives the
 * first time somebody actually opens it.
 */
export function AssistantLauncher({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Assistant"
      aria-expanded={open}
      title="Assistant"
      className="press hit grid size-9 place-items-center rounded-full border border-line-strong bg-surface/60 shadow-control backdrop-blur-md hover:border-line-control/40 data-[open=true]:bg-surface-sunk"
      data-open={open}
    >
      <AgentMark size="sm" />
    </button>
  );
}
