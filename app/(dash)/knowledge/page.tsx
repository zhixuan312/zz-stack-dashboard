'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, BookOpen, CheckCircle2, History, SearchX } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Button, EmptyState, PageControl, SearchInput, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Time, Toolbar, usePaged,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { useConsole, useConsoleMode, type KnowledgeNode } from '@/lib/api';
import {
  filterKnowledgeNodes, knowledgeNodeHref, tagFacetCounts, teamFacetOptions,
} from '@/lib/knowledge-filters';

/** Tags shown before the "+N more" control. The rest are one click away, never scrolled to. */
const TAGS_SHOWN = 10;

/**
 * The knowledge base: the shelf, and each row opens the node on its own page — the same
 * list → entry shape Initiatives has.
 *
 * TEAM IS SHOWN ON EVERY ROW when more than one team is in view. Each team numbers its own
 * nodes from 0001, so a list mixing two teams reads "1, 1, 2, 2, 3, 3" and looks duplicated
 * — which is exactly how it was read the first time anybody opened it. The number alone was
 * never an identity.
 */
export default function KnowledgePage() {
  const { mode } = useConsoleMode();
  const [filter, setFilter] = useState('');
  const [team, setTeam] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState(false);

  // ONE READ, ALWAYS THE SAME. The gateway scopes this to the caller's acting team in team
  // mode and spans every team in platform mode, so there is nothing for this page to name.
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');

  const nodes = list.data?.nodes ?? [];
  // Teams actually present in what loaded — answers "does this list mix teams", which the
  // row label and the count need. NOT the team control's options (see `teamFacetOptions`).
  const teamsInView = [...new Set(nodes.map((n) => n.team))].sort();
  const superseded = nodes.filter((n) => n.superseded_by).length;
  const adopted = nodes.length - superseded;
  // The newest node's own recorded date. `updated` is an instant, so the max is a string
  // comparison on ISO — no Date objects allocated per row to answer one question.
  const lastRecorded = nodes.length
    ? nodes.reduce((a, n) => (n.updated > a ? n.updated : a), nodes[0].updated).slice(0, 10)
    : null;
  const teamOptions = teamFacetOptions(nodes);
  const tagCounts = tagFacetCounts(nodes);
  const rows = filterKnowledgeNodes(nodes, { team, tags: selectedTags, search: filter });
  const filtersActive = team !== 'all' || selectedTags.length > 0 || filter.trim().length > 0;
  // A selected tag past the cut stays visible, or deselecting it means expanding first.
  const tagsShown = allTags
    ? tagCounts
    : tagCounts.filter((t, i) => i < TAGS_SHOWN || selectedTags.includes(t.tag));

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function clearFilters() {
    setFilter('');
    setTeam('all');
    setSelectedTags([]);
  }

  return (
    <DashboardPage
      title="Knowledge"
      description="What the platform has learned, kept as nodes. Each one comes out of a real initiative."
      showPeriod={false}
      updatedAt={new Date()}
      subnav={<KnowledgeTabs active="nodes" />}
      // THE SAME FOUR QUESTIONS THE SHELF IS SCANNED FOR, above it rather than counted by
      // eye down the list. `superseded` is the one worth a tile of its own: a shelf where
      // half the nodes have been replaced is a different thing to read than one where none
      // have, and nothing on the page said so.
      metrics={
        nodes.length
          ? [
              { label: 'Nodes', value: nodes.length, sublabel: 'On this shelf',
                icon: <BookOpen /> },
              { label: 'Adopted', value: adopted, muted: adopted === 0,
                sublabel: 'Current lessons', icon: <CheckCircle2 /> },
              { label: 'Superseded', value: superseded, muted: superseded === 0,
                sublabel: 'Replaced, still readable', icon: <Archive /> },
              { label: 'Last recorded', value: lastRecorded ?? '—', muted: !lastRecorded,
                sublabel: 'Most recent node', icon: <History /> },
            ]
          : undefined
      }
    >
      <Query query={list}>
        {() => (
          <Panel
            title="Nodes"
            aside={
              teamsInView.length > 1
                ? `${rows.length} of ${nodes.length} across ${teamsInView.length} teams`
                : `${rows.length} of ${nodes.length}`
            }
            padded={false}
          >
            <Toolbar className="border-b border-line p-3">
              <div className="min-w-0 flex-1">
                <SearchInput label="titles and bodies" value={filter} onChange={setFilter} />
              </div>
              {/* PLATFORM MODE ONLY. The shelf spans every team there, so choosing one is a
                  real narrowing of rows already on screen. In team mode the shelf that
                  loaded IS the acting team's, and switching teams is a Settings act. */}
              {mode === 'platform' && teamOptions.length > 1 ? (
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger className="w-[13rem]" aria-label="Team">
                    <SelectValue placeholder="All teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teams</SelectItem>
                    {teamOptions.map((o) => (
                      <SelectItem key={o.slug} value={o.slug}>
                        <span className="flex w-full items-center justify-between gap-4">
                          <span className="truncate">{o.slug}</span>
                          <span className="tabular-nums text-ink-faint">{o.count}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {filtersActive ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </Toolbar>
            {/* The tags actually present, each counted from the loaded set (see
                `tagFacetCounts`), and selectable — a real facet, not the substring match the
                search box does. Multiple tags OR together; see `filterKnowledgeNodes`. */}
            {tagCounts.length ? (
              <div
                role="group"
                aria-label="Tags"
                className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2.5"
              >
                {tagsShown.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selectedTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[11px]',
                      selectedTags.includes(tag)
                        ? 'bg-accent-tint text-accent-deep'
                        : 'bg-surface-2 text-ink-faint hover:bg-accent-tint hover:text-accent-deep',
                    )}
                  >
                    {tag} <span className="opacity-70">{count}</span>
                  </button>
                ))}
                {tagCounts.length > TAGS_SHOWN ? (
                  <button
                    type="button"
                    onClick={() => setAllTags((v) => !v)}
                    className="px-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    {allTags ? 'Fewer tags' : `+${tagCounts.length - tagsShown.length} more`}
                  </button>
                ) : null}
              </div>
            ) : null}
            <NodeTable
              rows={rows}
              multiTeam={teamsInView.length > 1}
              resetKey={JSON.stringify([filter.trim().toLowerCase(), team, selectedTags])}
            />
            {rows.length === 0 ? (
              /* TWO EMPTY STATES, NOT ONE. "Nothing matches your filters" and "nothing has
                 been written here yet" are different facts about the product, and a blank
                 list's silence must never be how a reader learns which one they are
                 looking at. */
              <EmptyState
                className="py-10"
                illustration={
                  filtersActive
                    ? { src: '/assets/brand/state-notfound.png', width: 78, height: 96 }
                    : { src: '/assets/brand/state-empty.png', width: 78, height: 96 }
                }
                icon={filtersActive ? <SearchX className="size-5" strokeWidth={2} /> : <Archive className="size-5" strokeWidth={2} />}
                title={filtersActive ? 'Nothing matches the selected filters' : 'Nothing to read yet'}
                description={
                  filtersActive
                    ? 'Every node is filtered out by the current team, tag or search.'
                    : 'No knowledge has been written to this shelf. A node arrives when an initiative closes and something in it was worth keeping.'
                }
                action={
                  filtersActive ? (
                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            ) : null}
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** The shelf, ten rows at a time. ITS OWN COMPONENT so it can hold the page state — a hook
 *  cannot be called from the `Query` render prop. */
function NodeTable({ rows, multiTeam, resetKey }: {
  rows: KnowledgeNode[]; multiTeam: boolean; resetKey: string;
}) {
  const { page, controls } = usePaged(rows, resetKey);
  if (rows.length === 0) return null;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[1%]">Node</TableHead>
            <TableHead>Title</TableHead>
            <TableHead hideBelow="lg">Tags</TableHead>
            <TableHead hideBelow="md">Status</TableHead>
            <TableHead hideBelow="md">Recorded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((n) => (
            <TableRow key={n.key}>
              {/* The team only when there is more than one shelf — the number is unique
                  inside a team, so naming it matters the moment two are shown together. */}
              <TableCell className="whitespace-nowrap font-mono text-xs text-ink-faint">
                {multiTeam ? `${n.team} · ${n.num}` : n.num}
              </TableCell>
              <TableCell>
                <Link
                  href={knowledgeNodeHref(n.team, n.path)}
                  className="font-medium leading-snug text-accent hover:underline"
                >
                  {n.title}
                </Link>
              </TableCell>
              <TableCell hideBelow="lg">
                <span className="flex flex-wrap gap-1">
                  {(n.tags ?? []).slice(0, 3).map((t) => (
                    <span key={t} className="rounded-[var(--r-sm)] bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">
                      {t}
                    </span>
                  ))}
                </span>
              </TableCell>
              <TableCell hideBelow="md">
                <Badge variant={n.status === 'adopted' ? 'sage' : 'neutral'} dot>{n.status}</Badge>
              </TableCell>
              <TableCell hideBelow="md"><Time value={n.updated} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
