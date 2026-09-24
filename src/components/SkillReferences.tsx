'use client';

import { Panel } from '@/components/Panel';
import { ProseBlock } from '@/components/patterns/prose-block';
import type { SkillText } from '@/lib/api-shapes';

/**
 * What ships beside the skill — the reference material the Agent Skills standard puts next
 * to SKILL.md — on its own tab rather than stacked below the skill text.
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
