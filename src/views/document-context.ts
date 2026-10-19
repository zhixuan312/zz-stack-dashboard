/**
 * One document's shared context (decision 0011): what the page and the assistant are both told about what a document
 * is, where it stands with its gate, and how it changed.
 */
import type { DocumentDetail } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount, formatKb } from '@/lib/format-units';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';

/** How much of the document's own text a context carries: enough to answer from, inside a view's budget. */
const BODY_LIMIT = 1200;

/** Where a document stands with its gate, in the words the page's own badge uses. */
function approvalOf(d: Pick<DocumentDetail, 'status' | 'gated' | 'correction' | 'approved_by' | 'approved_at'>): string {
  if (d.status === 'approved') return `approved${d.approved_by ? ` by ${d.approved_by}` : ''}${d.approved_at ? ` on ${formatDate(d.approved_at)}` : ''}`;
  if (d.correction) return `correction v${d.correction} awaiting approval`;
  if (d.gated === false) return 'delivered; its flow asks for no approval';
  if (d.gated === true) return 'awaiting a person\'s approval';
  return 'not a flow document, so no approval applies';
}

/**
 * What the page draws that this context does not carry, said every time, so an agent on the page never takes the
 * context for the whole of it: the text past what it quotes, earlier versions' text and the change between two (read
 * one version at a time), the claims' own words, the sources' own text, and the review metadata's tags and fields.
 */
function leftOut(d: DocumentDetail, text: string): string[] {
  if (!text) return ['This document has no body in the store.'];
  const out: string[] = [];
  if (text.length > BODY_LIMIT) out.push(`Only the first ${formatCount(BODY_LIMIT)} characters of the text are here; the rest is on the page.`);
  out.push(d.versions.length > 1
    ? 'Earlier versions\' text, and what changed between two, are read one version at a time on the page; this carries the current text alone.'
    : 'This carries the current text alone; the page reads any other version by its number.');
  if (d.decisionCounts.rows) out.push('The claims\' own words are in the page\'s claims table; this counts them.');
  if (d.sources.length) out.push('A source\'s own text is on its page; this names them.');
  if (d.tags?.length || Object.keys(d.fields).length) out.push('Its tags and its flow\'s fields are on the page, not here.');
  return out;
}

export function documentContext(d: DocumentDetail, arrival: Arrival): SharedContext {
  const base = `/initiatives/${d.team}/${d.initiative}`;
  const text = (d.body ?? '').trim().replace(/\s+/g, ' ');
  const insights: Insight[] = [];
  if (text) insights.push({ text: `The document${text.length > BODY_LIMIT ? ' opens' : ' reads'}: ${text.slice(0, BODY_LIMIT)}${text.length > BODY_LIMIT ? ` … (${formatCount(text.length - BODY_LIMIT)} more characters on the page)` : ''}` });
  if (d.gated === true && !d.approved_by) insights.push({ text: 'Approval is given on this page, by a member of the document\'s team who has been shown this exact snapshot. An agent cannot approve it.' });
  if (d.versions.length > 1) insights.push({ text: `Its versions, oldest first: ${listed(d.versions, (v) => `v${v.version} ${formatDate(v.updated_at)}${v.status === 'approved' ? `, approved${v.approved_by ? ` by ${v.approved_by}` : ''}` : ''}`, 'see the version chain on the page', 10)}.` });
  if (d.sources.length) insights.push({ text: `Sources attached to it: ${listed(d.sources, (s) => s.title ?? s.path, 'see the initiative\'s page', 8)}.`, evidence: base });
  if (d.superseded_by) insights.push({ text: `It was superseded by ${d.superseded_by}.` });
  const c = d.decisionCounts;
  if (c.rows) insights.push({ text: `Its ledger records ${formatCount(c.rows)} ${plural(c.rows, 'claim')}: ${c.withVerdict} state a verdict, ${c.withQualifier} a qualifier and ${c.withChecker} name a checker.` });
  return budgeted({
    view: 'document',
    title: d.title ?? d.path,
    address: `${base}/${d.path}`,
    scope: `one document, ${d.path}, of initiative ${d.team}/${d.initiative}${d.flow ? ` (flow ${d.flow})` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Approval', value: approvalOf(d), definition: 'Approved is the gate on the document. Accepted is the stakeholder\'s verdict on what was built, recorded as the initiative\'s outcome.' },
      { label: 'Type', value: d.type },
      { label: 'Version', value: `v${d.current_version}`, change: `${d.versions.length} ${plural(d.versions.length, 'version')} in all` },
      { label: 'Updated', value: formatDateTime(d.updated_at) },
      { label: 'Size', value: formatKb(d.bytes / 1024) },
      { label: 'Stakeholder', value: d.stakeholder || 'none named' },
      ...(d.outcome ? [{ label: 'Outcome', value: d.outcome, definition: 'The initiative\'s outcome is recorded on this document.' }] : []),
    ],
    insights,
    unknowns: leftOut(d, text),
  });
}
