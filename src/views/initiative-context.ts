/**
 * One initiative's shared context (decision 0011): its state, where it is in its flow, its gates and its documents.
 */
import { initiativeState, ownGates, waitingGates } from '@/console/initiative-state';
import type { InitiativeDetail } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';

export function initiativeContext(d: InitiativeDetail, arrival: Arrival): SharedContext {
  const base = `/initiatives/${d.team}/${d.slug}`;
  const gates = ownGates(d);
  const waiting = waitingGates(d);
  const live = d.documents.filter((x) => !x.path.startsWith('sources/'));
  const sources = d.documents.length - live.length;
  const current = d.steps.find((s) => s.current);
  const approval = (x: InitiativeDetail['documents'][number]) => (x.status === 'approved' ? `approved${x.approved_by ? ` by ${x.approved_by}` : ''}` : x.gated === false ? 'no approval needed' : x.gated ? 'awaiting approval' : (x.status ?? 'no status'));
  const insights: Insight[] = [];
  if (waiting.length) insights.push({ text: `Waiting on a person's approval: ${waiting.join(', ')}. A person approves a document on its own page, after reading it.`, evidence: base });
  if (current && !d.closed) insights.push({ text: `It is at the ${current.name} step: ${current.what.replace(/\.$/, '')}.${current.produces ? ` That step produces ${current.produces}.` : ''}` });
  if (d.steps.length) insights.push({ text: `The flow's steps: ${d.steps.map((s) => `${s.name} ${s.state}`).join(', ')}.` });
  if (live.length) insights.push({ text: `Its documents: ${listed(live, (x) => `${x.path} (${approval(x)})`, `see ${base}`)}.` });
  if (d.correction) insights.push({ text: `${d.correction.path} changed after the close and its version ${d.correction.version} awaits approval again; the close stands meanwhile.`, evidence: `${base}/${d.correction.path}` });
  const c = d.decisionCounts;
  return budgeted({
    view: 'initiative',
    title: d.slug,
    address: base,
    scope: `one initiative of team ${d.team}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'State', value: initiativeState(d), definition: 'Waiting on you: a gate document is written and unapproved. Ready to close: every gate is approved and no outcome is recorded.' },
      { label: 'Flow position', value: d.of ? `stage ${d.at} of ${d.of}${d.stage ? `, ${d.stage}` : ''}` : 'no flow declared' },
      { label: 'Gates', value: gates.length ? `${gates.filter((g) => g.passed).length} of ${gates.length} approved` : 'none', definition: 'Documents the flow requires a person to approve. The handover is written after the close and is not counted.' },
      { label: 'Documents', value: `${formatCount(live.length)} ${plural(live.length, 'document')}`, change: `${sources} ${plural(sources, 'source')} attached` },
      ...(c.rows ? [{ label: 'Decisions', value: formatCount(c.rows), change: `${c.withVerdict} state a verdict`, definition: 'Claims its documents\' ledgers record.' }] : []),
    ],
    insights,
    unknowns: [
      ...(d.closed ? [`It is closed as ${d.outcome}${d.complete ? '' : ', and stopped short of everything its flow asks for'}.`] : []),
      ...(live.length ? [] : ['Nothing has been written in it yet.']),
    ],
  });
}
