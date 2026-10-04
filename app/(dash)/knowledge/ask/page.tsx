'use client';

import { useState } from 'react';
import { BookOpen, Tag } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Select } from '@/components/ui/select';
import { KnowledgeAsk } from '@/console/knowledge-ask';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { Prose } from '@/console/prose';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { KnowledgeNode, Me } from '@/lib/api-shapes';
import { tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';

const GUIDANCE = [
  "- **Everything in the team's folder:** specs, decisions, sources and knowledge nodes, not just the nodes on the Nodes tab.",
  '- **One team at a time:** a question is answered from one shelf, so there is no platform-wide answer to ask for.',
  '- **Citations are the platform’s:** built from the documents actually retrieved, never from the model’s own text.',
].join('\n');

/**
 * A question answered from one team's own documents. One team, always: `/ask` refuses `?scope=platform`, so in team
 * mode it is the team being acted for, and in platform mode a superadmin names one.
 */
export default function KnowledgeAskPage() {
  const me = useConsole<Me>('/me');
  const { mode } = useConsoleMode();
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');
  const nodes = list.data?.nodes ?? [];
  const teams = teamFacetOptions(nodes);
  const [picked, setPicked] = useState<string | null>(null);
  const team = mode === 'team' ? me.data?.activeTeam ?? null : picked ?? (teams.length === 1 ? teams[0].slug : null);
  const shelf = nodes.filter((n) => !team || n.team === team);

  return (
    <ConsolePage
      title="Knowledge"
      description="Ask a question and have it answered from a team's own documents."
      showPeriod={false}
      updatedAt={freshnessOf(list)}
      toolbar={<KnowledgeTabs active="ask" />}
      actions={mode === 'platform' && teams.length > 1 ? (
        <Select aria-label="Answer from" placeholder="Answer from…" value={team ?? undefined} onValueChange={setPicked} options={teams.map((o) => ({ value: o.slug, label: o.slug }))} className="w-52" />
      ) : undefined}
    >
      <Row split="tiles">
        <MetricTile label="Answering from" value={team ?? 'No team yet'} note={mode === 'team' ? 'The team you act for' : 'Pick one team above'} />
        <MetricTile label="Nodes on the shelf" icon={<BookOpen />} value={list.data ? shelf.length : '…'} note={team ? `On ${team}'s shelf` : 'Across every team'} />
        <MetricTile label="Subjects" icon={<Tag />} value={list.data ? tagFacetCounts(shelf).length : '…'} note="Distinct tags" />
      </Row>
      <Row split="2/3">
        <KnowledgeAsk team={team} />
        <Panel title="What this reads">
          <Prose size="sm">{GUIDANCE}</Prose>
        </Panel>
      </Row>
    </ConsolePage>
  );
}
