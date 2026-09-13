'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Archive, BookOpen, CheckCircle2, GitBranch, History, SearchX, Tag } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Button, EmptyState, SearchInput, Segmented, Time,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useConsole, useConsoleMode, type KnowledgeBody, type KnowledgeNode,
} from '@/lib/api';
import { filterKnowledgeNodes, tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';

/**
 * The knowledge base: the NODE on the left, the shelf on the right.
 *
 * The list was on the left and the reading pane on the right, which is the wrong
 * way round for the thing people come here to do. A reader arrives to read one
 * node; the list is how they got to it. Putting the prose on the left gives it
 * the wide column and the natural first fixation, and demotes the shelf to what
 * it is.
 *
 * TEAM IS SHOWN ON EVERY ROW, and the count says how many teams are in view.
 * Each team numbers its own nodes from 0001, so a list mixing two teams reads
 * "1, 1, 2, 2, 3, 3" and looks duplicated — which is exactly how it was read the
 * first time anybody opened it. The number alone was never an identity.
 */
export default function KnowledgePage() {
  const { mode } = useConsoleMode();
  const [filter, setFilter] = useState('');
  const [team, setTeam] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Seeded from `?open=<team>/<path>`, never re-read after mount: a citation from the ask
  // surface below (`citationHref`, `@/lib/citations`) is the only thing that ever sets this
  // in the URL, and once the reader has clicked into a different node by hand the address
  // bar is not what should keep steering `openKey`.
  const openFromUrl = useSearchParams().get('open');
  const [openKey, setOpenKey] = useState<string | null>(openFromUrl);

  // ONE READ, ALWAYS THE SAME. The gateway scopes this to the caller's acting team in team
  // mode and spans every team in platform mode, so there is nothing for this page to name:
  // the `?team=` variant existed to serve a team-mode facet that no longer exists, and a
  // fetch path nothing can reach is a fetch path that rots.
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');

  const nodes = list.data?.nodes ?? [];
  // Teams actually present in what loaded — answers "does this list mix
  // teams", which is what the row label, the count and the reading pane's
  // identifier need. NOT the same question as the team control's options
  // (see `teamFacetOptions`): a caller can belong to a second team with zero
  // nodes in view, and the control still has to name it.
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

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function clearFilters() {
    setFilter('');
    setTeam('all');
    setSelectedTags([]);
  }

  const selected = rows.find((n) => n.key === openKey) ?? rows[0] ?? null;
  const body = useConsole<KnowledgeBody>(
    selected ? `/knowledge/${selected.team}/${selected.path}` : null,
  );

  // Nodes that share a tag with the open one — the store records no node-to-node
  // link, so a shared subject is the honest form of "related", and it is labelled
  // as that rather than dressed up as a citation.
  const related = selected
    ? nodes.filter(
        (n) =>
          n.key !== selected.key &&
          (n.tags ?? []).some((t) => (selected.tags ?? []).includes(t)),
      )
    : [];

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
      // ONE child fills the column and owns the scrolling inside it. Left as the
      // default `outer`, the COLUMN scrolled and the two panes could not — so the
      // reader and the shelf moved together on one page scrollbar, which is the
      // thing that felt wrong. StatusDashboard's own comment says it: an item that
      // scrolls itself must not sit in a column that also scrolls, or both do.
      scroll="inner"
    >
      <Query query={list}>
        {() => (
          <div className="flex h-full min-h-0 flex-col gap-3">
            {/* TWO INDEPENDENT SCROLLERS, which is what the shell's own two-column
                branch does and what this page needed: the reader scrolls a 1,600-word
                node without losing their place in the shelf, and scrolls a 21-item
                shelf without moving the node. One page-level scrollbar makes each
                pane drag the other, and the taller one decides the height of both.

                `min-h-0` on the row is what makes it work — a grid row defaults to
                `auto`, which sizes to the tallest child, and a pane inside a row that
                has already grown has nothing to scroll inside. */}
            {/* A FIXED-HEIGHT ROW is what makes two independent scrollers possible.
                A grid row defaults to `auto` and sizes to its tallest child, so a
                pane inside a row that has already grown has nothing to scroll
                within — both panes then move together on the page scroller, which
                is what made this feel wrong. */}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              {/* ── the node itself ── */}
              <Panel
                title={
                  selected ? (
                    <span className="flex flex-col gap-1">
                      {/* The identifier ABOVE the sentence, because a node title
                          runs to fifteen words and a heading that long leaves a
                          right-aligned label nowhere to sit. */}
                      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">
                        {teamsInView.length > 1 ? `${selected.team} · node ${selected.num}` : `node ${selected.num}`}
                      </span>
                      <span className="text-balance leading-snug">{selected.title}</span>
                    </span>
                  ) : (
                    'Knowledge'
                  )
                }
                className="min-h-0 lg:overflow-hidden"
              >
                {selected ? (
                  <div className="lg:h-full lg:overflow-y-auto">
                  <Query query={body} skeletonRows={10}>
                    {(b) => (
                      <article className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={b.status === 'adopted' ? 'sage' : 'neutral'} dot>
                            {b.status}
                          </Badge>
                          <Badge variant="neutral">{b.type}</Badge>
                          <span className="text-xs text-ink-faint">recorded <Time value={b.updated} /></span>
                        </div>

                        {/* WHERE IT CAME FROM. Without this a node reads as an
                            assertion from nowhere; with it, the reader can open the
                            work that produced the lesson. */}
                        {b.evidence?.length ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-[var(--r)] border border-line bg-surface-2 px-3 py-2 text-xs">
                            <GitBranch className="size-3.5 text-ink-faint" aria-hidden />
                            <span className="text-ink-faint">Learned in</span>
                            {b.evidence.map((e) => (
                              <Link
                                key={e}
                                href={`/initiatives/${b.team}/${e}`}
                                className="font-medium text-accent hover:underline"
                              >
                                {e}
                              </Link>
                            ))}
                          </div>
                        ) : null}

                        {b.superseded_by ? (
                          <div className="rounded-[var(--r)] border border-[var(--amber)] bg-[var(--amber-tint)] px-3 py-2 text-xs text-[var(--amber-text)]">
                            Superseded by {b.superseded_by} — kept readable, no longer current.
                          </div>
                        ) : null}

                        {/* Prose measure, not full bleed: 74 characters is what the
                            type scale is set for, and a 1,600-character lesson set
                            across a 1,100px column is genuinely harder to read. */}
                        <p className="max-w-[74ch] whitespace-pre-wrap text-[13.5px] leading-[1.85] text-ink-soft">
                          {b.body.trim()}
                        </p>

                        {b.tags?.length ? (
                          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                            <Tag className="size-3.5 text-ink-faint" aria-hidden />
                            {/* Toggles the SAME facet the shelf's own tag list uses,
                                not the free-text box — two paths to "filter by this
                                tag" (one exact, one substring) would drift apart the
                                moment a tag was itself a substring of another. */}
                            {b.tags.map((t) => (
                              <button
                                key={t}
                                type="button"
                                aria-pressed={selectedTags.includes(t)}
                                onClick={() => toggleTag(t)}
                                className={cn(
                                  'rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[11px]',
                                  selectedTags.includes(t)
                                    ? 'bg-accent-tint text-accent-deep'
                                    : 'bg-surface-2 text-ink-faint hover:bg-accent-tint hover:text-accent-deep',
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {related.length ? (
                          <div className="border-t border-line pt-3">
                            <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">
                              Shares a subject with
                            </p>
                            <ul className="flex flex-col gap-1.5">
                              {related.slice(0, 5).map((n) => (
                                <li key={n.key}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenKey(n.key)}
                                    className="text-left text-[13px] text-accent hover:underline"
                                  >
                                    {n.title}
                                  </button>
                                  <span className="ml-2 text-[11px] text-ink-faint">
                                    node {n.num}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </article>
                    )}
                  </Query>
                  </div>
                ) : (
                  /* TWO EMPTY STATES, NOT ONE, and the mascot is what makes the difference
                     visible before the words are read. "Nothing matches your filters" and
                     "nothing has been written here yet" are different facts about the
                     product, and a blank pane's silence must never be how a reader learns
                     which one they are looking at — the same failure the missing team
                     control was.

                     This was a hand-rolled inline block until the brand adoption. It read
                     correctly and looked like a different product from the other 17 empty
                     surfaces, which is the exact thing a design system exists to stop. */
                  <EmptyState
                    /* `py-10`, NOT `!py-10`. tailwind-merge reads the bang as a separate
                       group, so `!py-10` ships BOTH it and EmptyState's `py-16` and wins
                       only on !important — an escalation to beat a conflict the merge
                       function exists to resolve, plus a dead class in the markup. The
                       plain form strips `py-16` properly and renders identically. */
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
                )}
              </Panel>

              {/* ── the shelf ── */}
              <Panel
                title="Nodes"
                aside={
                  // Knowledge is one platform shelf now, so naming a team on every
                  // row and in the count is noise. The wording only appears once
                  // there is genuinely more than one, which is the state a later
                  // team-level split would create.
                  teamsInView.length > 1
                    ? `${rows.length} of ${nodes.length} across ${teamsInView.length} teams`
                    : `${rows.length} of ${nodes.length}`
                }
                padded={false}
                className="min-h-0 lg:overflow-hidden"
              >
                {/* CONTROLS PINNED, LIST SCROLLS — the shape the journal uses.
                    The search sat above the panel as a floating input belonging to
                    nothing, and scrolling the shelf carried it away. It filters this
                    list, so it lives in this list's header and stays put. */}
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 flex-col gap-2 border-b border-line p-3">
                    <SearchInput label="titles and bodies" value={filter} onChange={setFilter} />
                    {/* PLATFORM MODE ONLY. The shelf spans every team there, so choosing
                        one is a real narrowing of rows already on screen.

                        IN TEAM MODE THERE IS NOTHING TO CHOOSE. A person acts for exactly
                        one team at a time — `principal.active_team_id`, which the gateway
                        reads on every request — so the shelf that loaded IS their team's,
                        and offering their OTHER memberships here was offering a shelf this
                        page had not fetched: pick one and the list empties, because those
                        rows were never asked for. Switching teams is a real act with real
                        consequences for every page at once, and it belongs where the other
                        facts about you live (Settings → Teams), not as a filter chip on one
                        list. This is the same standard Initiatives already held to, where
                        the team facet simply never appears for a caller with one team's
                        rows. */}
                    {mode === 'platform' ? (
                      <Segmented
                        label="Team"
                        value={team}
                        onChange={setTeam}
                        options={
                          // COUNTS ONLY WHERE THEY ARE TRUE. In platform mode every
                          // team's rows are on screen, so a count beside each is a
                          // real number. In team mode only the loaded shelf's rows
                          // are here, so every other team would read "(0)" — which
                          // says "this team has no knowledge" when it means "we did
                          // not fetch it". A slug with no number makes no claim.
                          teamOptions.length > 1
                            ? [
                                { value: 'all', label: mode === 'platform' ? `All (${nodes.length})` : 'My team' },
                                ...teamOptions.map((o) => ({
                                  value: o.slug,
                                  label: mode === 'platform' ? `${o.slug} (${o.count})` : o.slug,
                                })),
                              ]
                            : [
                                {
                                  value: 'all',
                                  label: teamOptions[0]
                                    ? `${teamOptions[0].slug} (${teamOptions[0].count})`
                                    : `All (${nodes.length})`,
                                },
                              ]
                        }
                      />
                    ) : null}
                    {/* The tags actually present, each counted from the loaded set
                        (not from what team/search has already narrowed to — see
                        `tagFacetCounts`), and selectable — a real facet, not the
                        substring match the search box does. Multiple tags OR
                        together within this facet; see `filterKnowledgeNodes` for
                        why, and for how this composes (AND) with team and search. */}
                    {tagCounts.length ? (
                      <div className="flex flex-col gap-1.5">
                        <span
                          id="knowledge-tag-facet-label"
                          className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint"
                        >
                          Tags
                        </span>
                        <div
                          role="group"
                          aria-labelledby="knowledge-tag-facet-label"
                          className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto"
                        >
                          {tagCounts.map(({ tag, count }) => (
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
                        </div>
                      </div>
                    ) : null}
                    {filtersActive ? (
                      <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="self-start">
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                  <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                  {rows.map((n) => (
                    <li key={n.key}>
                      <button
                        type="button"
                        onClick={() => setOpenKey(n.key)}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-colors hover:bg-surface-2',
                          selected?.key === n.key && 'bg-accent-tint',
                        )}
                      >
                        <span className="flex items-baseline gap-2">
                          <BookOpen className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                          <span className="flex-1 text-[13px] font-medium leading-snug text-ink">
                            {n.title}
                          </span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[22px] text-[11px] text-ink-faint">
                          {/* The team only when there is more than one shelf — the
                              number is unique inside a team, so naming it matters the
                              moment two are shown together and is clutter otherwise. */}
                          <span className="font-mono">
                            {teamsInView.length > 1 ? `${n.team} · ${n.num}` : n.num}
                          </span>
                          {(n.tags ?? []).slice(0, 3).map((t) => (
                            <span key={t} className="rounded-[var(--r-sm)] bg-surface-2 px-1.5 py-0.5 font-mono">
                              {t}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                  </ul>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
