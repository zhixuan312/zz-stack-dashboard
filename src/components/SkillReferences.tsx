'use client';

import { Panel } from '@/components/Panel';
import { ProseBlock } from '@/components/patterns/prose-block';
import type { SkillText } from '@/lib/api';

/**
 * WHAT SHIPS BESIDE THE SKILL — its own tab.
 *
 * The Agent Skills standard puts long reference material next to SKILL.md so it is read
 * when the work needs it rather than loaded every time. Stacked under the skill it had
 * the same problem in the browser that it solves in a context window: five thousand
 * characters of traps below five thousand characters of method, with nothing saying the
 * second one was there.
 */
export function SkillReferences({ skill }: { skill: SkillText }) {
  return (
    <>
      {skill.references.map((r) => (
        <Panel key={r.path} title={r.path} aside={`${r.content.length.toLocaleString()} characters`}>
          {r.path.endsWith('.md')
            ? <ProseBlock>{r.content}</ProseBlock>
            : <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.7] text-ink-soft">{r.content}</pre>}
        </Panel>
      ))}
    </>
  );
}
