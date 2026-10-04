'use client';

import { useMemo } from 'react';
import { Archive, BookOpen, CheckCircle2, History } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { KnowledgeNode } from '@/lib/api-shapes';
import { formatDate, formatRelative } from '@/lib/format-date';
import { filterKnowledgeNodes, knowledgeNodeHref, tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';

/**
 * The shelf. The team leads the number when more than one shelf is in view: every team numbers its own nodes from
 * 0001, so a mixed list read "1, 1, 2, 2" and looked duplicated.
 */
function columns(multiTeam: boolean): Column<KnowledgeNode>[] {
  return aligned([
    { key: 'num', header: 'Node', width: multiTeam ? 'w-36' : 'w-24', sortValue: (n) => `${n.team}/${n.num}`, cell: (n) => <span className="font-mono text-xs text-ink-3">{multiTeam ? `${n.team} · ${n.num}` : n.num}</span> },
    { key: 'title', header: 'Title', align: 'left', grow: true, mobile: 'title', sortValue: (n) => n.title, cell: (n) => <span className="block py-1 leading-snug font-medium whitespace-normal text-ink">{n.title}</span> },
    { key: 'tags', header: 'Tags', hideBelow: 'xl', cell: (n) => <span className="font-mono text-xs text-ink-3">{(n.tags ?? []).slice(0, 3).join(' · ') || '—'}</span> },
    // Colour only where it means something: superseded is still readable, so neutral; adopted is the current lesson.
    { key: 'status', header: 'Status', hideBelow: 'md', mobile: 'status', sortValue: (n) => n.status, cell: (n) => <Badge tone={n.status === 'adopted' ? 'positive' : 'neutral'} dot>{n.status}</Badge> },
    { key: 'updated', header: 'Recorded', numeric: true, mobile: 'fact', sortValue: (n) => n.updated, cell: (n) => <When at={n.updated} />, mobileCell: (n) => <>Recorded <When at={n.updated} /></> },
  ]);
}

/** What the platform has learned, kept as nodes. Each one comes out of a real initiative. */
export default function KnowledgePage() {
  const { mode } = useConsoleMode();
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');
  const [f, set] = useQueryState({ q: '', team: 'all', tag: 'all', sort: 'updated', dir: 'desc', page: '1' });
  const nodes = useMemo(() => list.data?.nodes ?? [], [list.data]);
  const multiTeam = new Set(nodes.map((n) => n.team)).size > 1;
  const rows = useMemo(() => filterKnowledgeNodes(nodes, { team: f.team, tags: f.tag === 'all' ? [] : [f.tag], search: f.q }), [nodes, f.team, f.tag, f.q]);
  const cols = useMemo(() => columns(multiTeam), [multiTeam]);
  const adopted = nodes.filter((n) => n.status === 'adopted').length;
  const latest = nodes.reduce<string | null>((a, n) => (!a || n.updated > a ? n.updated : a), null);
  const filtered = f.q !== '' || f.team !== 'all' || f.tag !== 'all';
  const clear = () => set({ q: '', team: 'all', tag: 'all', page: '1' });

  return (
    <ConsolePage
      title="Knowledge"
      description="What the platform has learned, kept as nodes. Each one comes out of a real initiative."
      showPeriod={false}
      updatedAt={freshnessOf(list)}
      toolbar={<KnowledgeTabs active="nodes" />}
    >
      <Row split="tiles">
        <MetricTile label="Nodes" icon={<BookOpen />} value={list.data ? nodes.length : '…'} note="On this shelf" />
        <MetricTile label="Adopted" icon={<CheckCircle2 />} value={list.data ? adopted : '…'} note="Current lessons" />
        <MetricTile label="Superseded" icon={<Archive />} value={list.data ? nodes.filter((n) => n.status === 'superseded').length : '…'} note="Replaced, still readable" />
        <MetricTile label="Last recorded" icon={<History />} value={latest ? formatRelative(latest) : 'Never'} note={latest ? formatDate(latest) : 'Nothing on the shelf'} />
      </Row>
      <DataTable
        caption="Knowledge nodes"
        noun="nodes"
        rows={rows}
        columns={cols}
        rowKey={(n) => n.key}
        rowHref={(n) => knowledgeNodeHref(n.team, n.path)}
        loading={list.isPending}
        error={failureOf(list)}
        onRetry={() => void list.refetch()}
        state={{ sort: f.sort, dir: f.dir, page: f.page }}
        onStateChange={set}
        filtered={filtered}
        onClearFilters={clear}
        empty={{ title: 'Nothing to read yet', body: 'A node arrives when an initiative closes and something in it was worth keeping.' }}
        toolbar={
          <FilterBar
            search={{ value: f.q, onChange: (v) => set({ q: v, page: '1' }), placeholder: 'Search titles and text' }}
            filters={[
              // Platform mode only: in team mode the shelf loaded is the acting team's, so another team empties it.
              ...(mode === 'platform' && multiTeam ? [{ key: 'team', label: 'Team', value: f.team, onChange: (v: string) => set({ team: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...teamFacetOptions(nodes).map((o) => ({ value: o.slug, label: `${o.slug} · ${o.count}` }))] }] : []),
              { key: 'tag', label: 'Tag', value: f.tag, onChange: (v) => set({ tag: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...tagFacetCounts(nodes).map((t) => ({ value: t.tag, label: `${t.tag} · ${t.count}` }))] },
            ]}
            result={<>{rows.length} of {nodes.length}</>}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
