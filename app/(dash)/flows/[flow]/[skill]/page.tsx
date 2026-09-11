'use client';

import { use } from 'react';
import { FlaskConical } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge, EmptyState } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { SkillReader } from '@/components/SkillReader';
import { SkillReferences } from '@/components/SkillReferences';
import { SkillEvaluation } from '@/components/SkillEvaluation';
import { SkillViewTabs, useSkillView } from '@/components/SkillViewTabs';
import { useConsole, type FlowRow, type Skill, type SkillDetail, type SkillText } from '@/lib/api';

/** Seconds → the coarsest unit that still reads as a duration. */
function dur(s: number): string {
  if (!s) return '—';
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

export default function SkillPage({ params }: { params: Promise<{ flow: string; skill: string }> }) {
  const { flow: flowName, skill: name } = use(params);
  const list = useConsole<{ skills: Skill[] }>('/skills');
  // WHICH FLOW, FROM THE URL. This searched every flow for a skill of this name,
  // which answers a question the address already answered — and answered it
  // differently if two flows ever shipped a skill of one name.
  const flows = useConsole<{ flows: FlowRow[] }>('/flows');
  const flow = flows.data?.flows.find((f) => f.flow === flowName);
  const step = flow?.steps.find((x) => x.name === name);
  const position = step?.position ?? null;
  // THE FRONT DOOR COUNTS. A flow's `stages` do not include its own entry skill, so
  // ops-flow — the one skill that describes the whole method — was the single skill of
  // the flow that could be read nowhere.
  const isEntry = !!flow && flow.entry?.name === name;
  // WHAT THIS STAGE WRITES AND WHAT CLOSES IT, from the flow's manifest — never from a table
  // of one flow's skills. This page carried a map of ops-flow's six, so every zz-skill-* and
  // zz-block-* stage was reported as producing nothing and having no gate. Both are
  // assertions, and for zz-skill-define — which writes rulers.md, the gate of its flow — both
  // were false. The manifest now records which stage writes each document, so this is a
  // lookup for any flow that exists or is added later.
  const produces = flow?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ') ?? '';
  const gatedHere = flow?.documents.find((x) => x.stage === name && x.gate);
  const closes = gatedHere ? { name: `approve ${gatedHere.name.replace(/\.md$/, '')}` } : null;
  const known = !flows.data || !!step || isEntry;

  const skill = list.data?.skills.find((s) => s.name === name);
  const detail = useConsole<SkillDetail>(known ? `/skills/${name}` : null);
  // THE SKILL ITSELF. This page could report that sm-intent scored 3.42 and never show
  // a line of what sm-intent asks for — a score about something the reader cannot see.
  const text = useConsole<SkillText>(known ? `/flows/${flowName}/skills/${name}` : null).data;
  const view = useSkillView(!!text?.references.length);

  return (
    <DashboardPage
      title={name}
      breadcrumb={[
        { label: 'Flows', href: '/flows' },
        { label: flowName, href: `/flows/${flowName}` },
        { label: name },
      ]}
      description={text?.description ?? 'One skill: what it costs to run, how a judge scores it, and what that came to.'}
      showPeriod={false}
      updatedAt={new Date()}
      subnav={<SkillViewTabs skill={text} view={view} />}
      // NO SIBLING SWITCHER. A strip of the flow's other steps sat here, and every
      // one of them is a row on the page you just came from — the breadcrumb goes
      // back there in one click. A second copy of a list you have already seen is
      // not navigation, it is the same list twice.
      // FOUR, not eight. The page used to open with two rows of metric cards,
      // which makes eight things equally loud and none of them the headline.
      // These four are what someone asks first; the rest are diagnostics and
      // live in "Where its calls went" below.
      metrics={
        skill
          ? [
              { label: 'Runs', value: formatCount(skill.runs), sublabel: 'recorded' },
              { label: 'Calls per run', value: skill.callsAvg.toFixed(1),
                sublabel: `${formatCount(skill.calls)} total · peak ${skill.callsMax}` },
              { label: 'Duration (median)', value: dur(skill.durationMedian),
                sublabel: `avg ${dur(skill.durationAvg)} · longest ${dur(skill.durationMax)}` },
              { label: 'Refusals',
                value: skill.calls ? `${((skill.refusals / skill.calls) * 100).toFixed(1)}%` : '—',
                sublabel: `${skill.refusals} of ${formatCount(skill.calls)} calls`,
                emphasis: skill.calls > 0 && skill.refusals / skill.calls > 0.05 },
            ]
          : undefined
      }
      // THE RAIL IS WHAT THE SKILL IS; the main column is what it did. Identity
      // was a five-row definition list in a full-width card, which left about
      // seventy percent of it empty; in the third-column it is the right shape
      // for the content. The verdict sits under it, so the rail reads
      // identity → conclusion and the main column is nothing but evidence.
      rail={
        // NOT GATED ON THE COST RECORD either — the identity of a skill is knowable
        // whether or not anybody has run it, and the front door is precisely the skill
        // with no runs. Version and Evaluated come from that record and say so when it
        // is missing; the rest comes from the catalog.
        known ? (
          <div className="flex flex-col gap-4">
            <Panel title="What this skill is">
              <dl className="flex flex-col gap-3 text-[13px]">
                <Row k="Does" v={<span className="text-ink-soft">{text?.description ?? '—'}</span>} />
                <Row k="Position" v={isEntry
                  ? `the front door of ${flow?.flow}`
                  : flow && position
                    ? `${position} of ${flow.steps.length} in ${flow.flow}`
                    : 'Not a step in any flow'} />
                <Row k="Produces" v={produces
                  ? <span className="font-mono text-xs">{produces}</span>
                  : <span className="text-ink-faint">nothing — this stage leaves work, not a document</span>} />
                <Row
                  k="Closed by"
                  v={closes
                    ? <Badge variant="accent" dot>{closes.name} — a person must approve</Badge>
                    : <Badge variant="neutral">no gate — the next step simply follows</Badge>}
                />
                <Row k="Version" v={<span className="font-mono text-xs">{skill?.version ?? text?.version ?? '—'}</span>} />
                <Row
                  k="Evaluated"
                  v={skill?.evaluated
                    ? <Badge variant="sage" dot>{`yes — ${skill.evaluated.documents} documents, judge ${skill.evaluated.judge}`}</Badge>
                    : <Badge variant="amber" dot>no rubric yet</Badge>}
                />
              </dl>
            </Panel>
            {/* THE VERDICT is derived from the numbers, so it needs them. A skill with
                no recorded run has none, and an invented conclusion would be the one
                thing on this page nothing stands behind. */}
            {skill ? (
              <Query query={detail} skeletonRows={3}>
                {(d) => <Conclusion skill={skill} detail={d} />}
              </Query>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <Query query={list}>
        {() =>
          !known ? (
            <Panel title="No such step">
              <EmptyState
                icon={<FlaskConical />}
                title={`'${name}' is not a step in ${flowName}`}
                description="It may have been renamed, or it belongs to another flow. The flow's own page lists the steps it declares."
              />
            </Panel>
          ) : (
            // NOT GATED ON `skill`. The cost record comes from recorded runs, so a skill
            // nobody has called is absent from it — and ops-flow, the front door that
            // describes the whole method, is exactly such a skill. Gating the page on it
            // rendered a header and an empty body for the one skill most worth reading.
            // The text stands on its own; the evaluation says "never run" for itself.
            <Query query={detail} skeletonRows={6}>
              {(d) => (
                <>
                  {view === 'read' && text ? <SkillReader skill={text} /> : null}
                  {view === 'references' && text ? <SkillReferences skill={text} /> : null}
                  {view === 'evaluation' ? (
                    <SkillEvaluation
                      skill={skill}
                      detail={d}
                      scoresHref={skill ? `/flows/${flowName}/${name}/scores` : undefined}
                    />
                  ) : null}
                </>
              )}
            </Query>
          )
        }
      </Query>
    </DashboardPage>
  );
}

/** A label/value line in the rail's identity panel — stacked, because the rail
 *  is a third of the page and a two-column list wraps badly in it. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

/**
 * The verdict, written from the numbers on the page rather than stored beside
 * them. A conclusion in a fixture is a conclusion that stops being true the
 * first time the data moves; this one cannot drift because it is derived.
 */
function Conclusion({ skill, detail }: { skill: Skill; detail: SkillDetail }) {
  const rate = skill.calls ? (skill.refusals / skill.calls) * 100 : 0;
  const scored = detail.dimensions.filter((d) => d.mean !== null);
  const worst = scored.length ? scored.reduce((a, b) => ((b.mean ?? 5) < (a.mean ?? 5) ? b : a)) : null;
  const heaviest = detail.surfaces[0];

  return (
    <div className="rounded-[var(--r-lg)] border-2 border-ink bg-surface p-4">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">Conclusion</p>
      <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
        <li>
          <b className="text-ink">Cost.</b> {skill.runs} runs at {skill.callsAvg.toFixed(1)} calls each,
          median {dur(skill.durationMedian)}, {Math.round(skill.kbPerRun)} KB per run
          ({skill.mbTotal} MB in total).
          {heaviest ? <> Most of its calls go to <b className="text-ink">{heaviest.surface}</b> ({heaviest.calls}).</> : null}
        </li>
        <li>
          <b className="text-ink">Reliability.</b>{' '}
          {rate > 5
            ? <>It refuses <b className="text-[var(--rose-deep)]">{rate.toFixed(1)}%</b> of its calls — high enough to be the thing to look at.</>
            : rate > 0
              ? <>A {rate.toFixed(1)}% refusal rate: {skill.refusals} refusals over {formatCount(skill.calls)} calls.</>
              : <>No refusals recorded at all.</>}
        </li>
        <li>
          <b className="text-ink">Quality.</b>{' '}
          {worst
            ? <>Mean {skill.evaluated?.mean?.toFixed(2)} across {scored.length} dimensions. The weakest is{' '}
                <b className="text-ink">{worst.name}</b> at {worst.mean?.toFixed(2)}
                {worst.low ? <>, with {worst.low} document{worst.low > 1 ? 's' : ''} scoring ≤1</> : null}.</>
            : <>Nothing scores this skill. {skill.name === 'sm-build'
                ? 'It is the only step that writes, and it is unevaluated — which is the honest reason the flow puts three human approvals in front of it.'
                : 'Writing a rubric for it is a decision nobody has made.'}</>}
        </li>
      </ul>
    </div>
  );
}

