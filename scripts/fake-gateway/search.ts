/**
 * The fake gateway's search: `GET /search`, in the shape the real route answers (`linkable` in the gateway's
 * console/search.ts), over the same documents and nodes the other routes serve.
 *
 * It is a stand-in for a ranking, not a copy of one. The platform's search fuses full text, tags and cited initiatives;
 * this counts which of the question's words a text holds, which is enough to answer the two things a page or a check
 * asks of it: that a document is found by words in its BODY, and that an answer says what kind of answer it is. The
 * three kinds are the real route's: every word found, some of them found (leads, and the note says so), and nothing
 * found, with the search's own verdict.
 *
 * Whose search: the team the signed-in person acts for, as the platform runs it, and the superadmin's when no team is
 * named, with the platform's shared shelf beside it, whose lessons come back as `shelf: "platform"` among the team's. A
 * lesson's citations are that team's alone, the rest counted, as the platform answers them; a document's are its own
 * team's.
 */
import type { SearchAnswer, SearchHit } from '../../src/lib/api-shapes.ts';
import { ME } from './people.ts';
import { INITIATIVES, documentDetail, initiativeDetail } from './work.ts';
import { SHARED_TEAM, lesson, searchedShelf } from './work-knowledge.ts';

type Candidate = Omit<SearchHit, 'excerpt' | 'score' | 'via'> & { text: string };

/** Every document and node of one team, and the shared shelf's lessons, with the text a search reads. */
function corpus(team: string, initiative: string | null): Candidate[] {
  const documents = INITIATIVES.filter((i) => i.team === team && (!initiative || i.slug === initiative)).flatMap((i) =>
    (initiativeDetail(i.team, i.slug)?.documents ?? []).flatMap((row): Candidate[] => {
      const d = documentDetail(i.team, i.slug, row.path);
      if (!d) return [];
      return [{
        kind: 'document', team, shelf: 'team', initiative: i.slug, path: row.path, title: d.title ?? row.path, type: d.type || null,
        status: d.status || null, superseded_by: null, tags: d.tags ?? [], evidence: [], cited_elsewhere: 0, flow: d.flow, outcome: d.outcome,
        approved_by: d.approved_by, approved_at: d.approved_at, updated: d.updated_at, text: d.body ?? '',
      }];
    }));
  // A node belongs to no initiative, so a search narrowed to one finds none.
  const nodes = initiative ? [] : searchedShelf(team).map((n): Candidate => ({
    kind: 'node', team: n.team, shelf: n.team === SHARED_TEAM ? 'platform' : 'team', initiative: null, path: n.path, title: n.title, type: n.type,
    status: n.status, superseded_by: n.superseded_by, tags: n.tags ?? [], evidence: n.evidence ?? [], cited_elsewhere: n.cited_elsewhere, flow: null, outcome: null,
    approved_by: null, approved_at: null, updated: n.updated, text: lesson(n.team, n.path)?.body ?? n.excerpt,
  }));
  return [...documents, ...nodes];
}

/** Up to 600 characters round the first word found, whitespace collapsed, each found word between `**`. */
function excerptOf(text: string, words: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = Math.min(...words.map((w) => flat.toLowerCase().indexOf(w)).filter((i) => i >= 0));
  const from = Math.max(0, (Number.isFinite(at) ? at : 0) - 120);
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return flat.slice(from, from + 600).replace(new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi'), '**$1**');
}

export function search(q: string, limit: number, initiative: string | null, team = ME.activeTeam ?? ''): SearchAnswer {
  const words = [...new Set(q.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 1 && w !== 'or') ?? [])];
  const scored = corpus(team, initiative)
    .map((c) => ({ c, found: words.filter((w) => `${c.title} ${c.text}`.toLowerCase().includes(w)) }))
    .filter((x) => x.found.length > 0);
  const whole = scored.filter((x) => x.found.length === words.length);
  // The platform asks again with OR when no text holds every word, and says the rows are leads.
  const broadened = whole.length === 0 && scored.length > 0;
  const ranked = (broadened ? scored : whole).sort((a, b) => b.found.length - a.found.length || (b.c.updated ?? '').localeCompare(a.c.updated ?? ''));
  const results = ranked.slice(0, limit).map(({ c: { text, ...row }, found }, i): SearchHit => ({
    ...row, excerpt: excerptOf(text, found), score: Number((1 / (60 + i)).toFixed(5)), via: [broadened ? 'lexical-broad' : 'lexical'],
  }));
  const none = results.length === 0;
  return {
    team, query: q, ranked_total: ranked.length, returned: results.length, withheld: ranked.length - results.length,
    superseded_in_results: results.filter((r) => r.status === 'superseded' || r.superseded_by).length,
    note: none
      ? `Nothing in team:${team} matches this question. The search covered every document and node there and reached all of it.`
      : broadened
        ? 'No document contains all of those terms together. These match SOME of them, best first — treat them as leads rather than as an answer, and narrow the question to confirm one.'
        : ranked.length > results.length ? `${ranked.length - results.length} lower-ranked results not shown — ask a narrower question to see them.` : null,
    recall: none ? 'no_relevant_match_in_searched_scope' : null,
    results,
  };
}
