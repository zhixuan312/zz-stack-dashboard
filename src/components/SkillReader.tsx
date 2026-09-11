'use client';

import { Panel } from '@/components/Panel';
import { ProseBlock } from '@/components/patterns/prose-block';
import type { SkillText } from '@/lib/api';

/**
 * THE SKILL ITSELF, read. Its own tab — what ships BESIDE it is another.
 *
 * Shared by both skill pages, because a skill is one kind of thing wherever it lives:
 * a flow runs it, a block publishes it, and either way the useful thing to do with one
 * is read what it says. The flow page could report that ops-intent scored 3.42 and never
 * show a line of what ops-intent asks for — a score about something the reader cannot see.
 */
export function SkillReader({ skill }: { skill: SkillText }) {
  return (
    <>
      <Panel title="The skill" aside={`${skill.body.length.toLocaleString()} characters`}>
        <ProseBlock>{skill.body}</ProseBlock>
      </Panel>

    </>
  );
}
