'use client';

import { useMemo } from 'react';
import { Archive, BookOpen, Search, SearchX } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { KnowledgeList, KnowledgeRow, KnowledgeSummary } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { KNOWLEDGE_KINDS, PAGE_SIZE, knowledgeContext, knowledgePath, narrowed } from '@/views/knowledge-context';

/** The shelf, in the server's order: newest first, paged where it is read. */
const COLUMNS: Column<KnowledgeRow>[] = aligned([
  { key: 'num', header: 'Lesson', width: 'w-24', cell: (n) => <span className="font-mono text-xs text-ink-3">{n.num}</span> },
  { key: 'title', header: 'Title', align: 'left', grow: true, mobile: 'title', cell: (n) => <span className="block py-1 leading-snug font-medium whitespace-normal text-ink">{n.title}</span> },
  { key: 'kind', header: 'Kind', hideBelow: 'lg', cell: (n) => <span className="font-mono text-xs text-ink-3">{n.type}</span> },
  // Colour only where it means something: superseded is still readable, so neutral; adopted is the current lesson.
  { key: 'status', header: 'Status', hideBelow: 'md', mobile: 'status', cell: (n) => <Badge tone={n.status === 'adopted' ? 'positive' : 'neutral'} dot>{n.status}</Badge> },
  { key: 'updated', header: 'Recorded', numeric: true, mobile: 'fact', cell: (n) => <When at={n.updated} />, mobileCell: (n) => <>Recorded <When at={n.updated} /></> },
]);

const KIND_OPTIONS = [{ value: 'all', label: 'All' }, ...KNOWLEDGE_KINDS.map((k) => ({ value: k, label: k }))];

/** What the active team has learned, kept as lessons, and how its searches went. Filtered and paged by the server. */
export function KnowledgeView() {
  useLive(['knowledge']);
  const [f, set] = useQueryState({ q: '', kind: 'all', page: '1' });
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  const filters = useMemo(() => ({ q: f.q, kind: f.kind }), [f.q, f.kind]);
  const page = Math.max(1, Number(f.page) || 1);
  const summary = useConsole<KnowledgeSummary>('/knowledge/summary');
  const list = useConsole<KnowledgeList>(knowledgePath(filters, { offset: (page - 1) * PAGE_SIZE }));
  const tiles = summary.data?.tiles;
  const filtered = narrowed(filters);
  const clear = () => set({ q: '', kind: 'all', page: '1' });
  const arrival = useArrival(list, summary);
  const context = list.data
    ? knowledgeContext({ summary: summary.data, list: list.data, filters, page, ...arrival })
    : pendingContext({ view: 'knowledge', title: 'Knowledge', address: '/knowledge', scope: 'your active team\'s knowledge shelf' }, failureOf(list));
  const mark = summary.isPending ? '…' : '—';

  return (
    <ConsolePage
      title="Knowledge"
      description="What your team has learned, kept as lessons. Each one comes out of a real initiative."
      showPeriod={false}
      updatedAt={freshnessOf(list, summary)}
      context={context}
      toolbar={<KnowledgeTabs active="nodes" />}
    >
      <Row split="tiles">
        <MetricTile label="Standing" icon={<BookOpen />} value={tiles?.standing.value ?? mark} note={tiles ? `${tiles.standing.imported} imported` : 'On the shelf now'} />
        <MetricTile label="Superseded" icon={<Archive />} value={tiles?.superseded.value ?? mark} note="Replaced, still readable" />
        <MetricTile label="Searches last week" icon={<Search />} value={tiles?.searches.figure.value ?? mark} note="From the page, the assistant and MCP" />
        <MetricTile label="Found nothing" icon={<SearchX />} value={tiles?.noResult.figure.value ?? mark} note={tiles ? `Of ${tiles.noResult.denominator ?? 0} last week` : 'Searches with no result'} />
      </Row>
      <DataTable
        caption="Lessons"
        noun="lessons"
        rows={list.data?.rows ?? []}
        columns={COLUMNS}
        rowKey={(n) => n.key}
        rowHref={(n) => knowledgeNodeHref(n.team, n.path)}
        manual
        total={list.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        pageSizes={[PAGE_SIZE]}
        loading={list.isPending}
        error={failureOf(list)}
        onRetry={() => void list.refetch()}
        state={{ sort: '', dir: 'desc', page: String(page) }}
        onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
        filtered={filtered}
        onClearFilters={clear}
        empty={{ title: 'Nothing to read yet', body: 'A lesson arrives when an initiative closes and something in it was worth keeping.' }}
        toolbar={
          <FilterBar
            search={{ value: draft, onChange: setDraft, placeholder: 'Search lessons' }}
            filters={[{ key: 'kind', label: 'Kind', value: f.kind, onChange: (v) => set({ kind: v, page: '1' }), options: KIND_OPTIONS }]}
            result={<>{list.data ? `${list.data.total} ${plural(list.data.total, 'lesson')}` : '…'}</>}
            ask={<AskAbout question={filtered ? 'What do the lessons in this list say, taken together?' : 'What has the team learned most about, and which questions found nothing?'} />}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
