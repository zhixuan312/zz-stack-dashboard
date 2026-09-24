'use client';

import { Panel } from '@/components/Panel';
import { ProseBlock } from '@/components/patterns/prose-block';
import type { SkillText } from '@/lib/api-shapes';

/**
 * The skill's own text, on its own tab; what ships beside it is another tab.
 */
export function SkillReader({ skill }: { skill: SkillText }) {
  return (
    <Panel title="The skill" aside={`${skill.body.length.toLocaleString()} characters`}>
      <ProseBlock>{skill.body}</ProseBlock>
    </Panel>
  );
}
