'use client';

import { useState } from 'react';
import { BookOpen, MessageCircleQuestion, Tag, Users } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { KnowledgeAsk } from '@/components/KnowledgeAsk';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';
import { Query } from '@/components/Query';
import { Segmented } from '@/components/ui';
import {
  useConsole, useConsoleMode, type KnowledgeNode, type Me,
} from '@/lib/api';
import { tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';

/**
 * Ask — a question answered from one team's own documents.
 *
 * IT USED TO SIT ON TOP OF THE SHELF, a form squeezed above a two-pane reader, and it read
 * as a search box for the list below it. It is not: `POST /ask` answers from every document
 * in the team's folder — specs, decisions, sources — not only from the `_knowledge/` nodes
 * the shelf shows, so putting it above the shelf described its scope wrongly as well as
 * cramping both.
 *
 * ONE TEAM, ALWAYS. `/ask` refuses `?scope=platform` outright (console-ask.ts: a question
 * is answered from one team's knowledge), so in team mode this is the team being acted for
 * and in platform mode a superadmin has to name one. That is the only control on the page.
 */
export default function KnowledgeAskPage() {
  const meQ = useConsole<Me>('/me');
  const { mode } = useConsoleMode();
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');
  const nodes = list.data?.nodes ?? [];
  const teamOptions = teamFacetOptions(nodes);
  const [picked, setPicked] = useState<string | null>(null);

  // In team mode there is nothing to choose — the gateway already scoped the read, and the
  // team being acted for is the team whose documents answer. Switching it is a Settings act.
  const team = mode === 'team'
    ? meQ.data?.activeTeam ?? null
    : picked ?? (teamOptions.length === 1 ? teamOptions[0].slug : null);

  const tags = tagFacetCounts(nodes);

  return (
    <DashboardPage
      title="Knowledge"
      description="Ask a question and have it answered from your team's own documents."
      showPeriod={false}
      updatedAt={new Date()}
      subnav={<KnowledgeTabs active="ask" />}
      metrics={[
        { label: 'Answering from', value: team ?? '—', muted: !team,
          sublabel: mode === 'team' ? 'The team you act for' : 'Pick one team' },
        { label: 'Nodes on the shelf', value: nodes.length, sublabel: 'Searchable', icon: <BookOpen /> },
        { label: 'Subjects', value: tags.length, muted: tags.length === 0,
          sublabel: 'Distinct tags', icon: <Tag /> },
        { label: 'Teams in view', value: teamOptions.length, muted: teamOptions.length === 0,
          sublabel: mode === 'team' ? 'Yours' : 'Across the platform', icon: <Users /> },
      ]}
      note={
        '### What this reads\n' +
        "- **Everything in the team's folder** — specs, decisions, sources and knowledge nodes, " +
        'not just the nodes on the Nodes tab\n' +
        '- **One team at a time** — a question is answered from one shelf, so there is no ' +
        'platform-wide answer to ask for\n' +
        '- **Citations are the platform’s** — built from the documents actually retrieved, ' +
        'never from the model’s own text'
      }
      noteIcon={<MessageCircleQuestion className="size-4" />}
      noteTitle="Ask"
    >
      <Query query={list} skeletonRows={4}>
        {() => (
          <div className="flex flex-col gap-4">
            {/* Only where it is a real choice — see `teamFacetOptions`. A superadmin
                reading the fleet has to name one team because the answer comes from one
                shelf; everybody else already is one. */}
            {mode === 'platform' && teamOptions.length > 1 ? (
              <Segmented
                label="Answer from"
                value={team ?? ''}
                onChange={setPicked}
                options={teamOptions.map((o) => ({ value: o.slug, label: `${o.slug} (${o.count})` }))}
              />
            ) : null}
            <KnowledgeAsk team={team} />
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
