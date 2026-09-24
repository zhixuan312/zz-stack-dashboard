'use client';

import { use } from 'react';
import { FlaskConical } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge, EmptyState, Row } from '@/components/ui';
import { formatCount, formatKb, formatSeconds } from '@/lib/format';
import { SkillReader } from '@/components/SkillReader';
import { SkillReferences } from '@/components/SkillReferences';
import { SkillCost } from '@/components/SkillCost';
import { SkillViewTabs, useSkillView } from '@/components/SkillViewTabs';
import { freshnessOf, useConsole } from '@/lib/api';
import { type PluginRow, type Skill, type SkillDetail, type SkillText } from '@/lib/api-shapes';

/**
 * Layer three: one skill, read. Shows the text and what it cost to run, whichever kind of
 * plugin ships it.
 *
 * Whose it is leads the page, because it decides what can be done about what you read: a skill
 * marked theirs is vendored from somebody else, and changing it means agreeing a change with
 * them.
 */
export default function PluginSkillPage({ params }: { params: Promise<{ plugin: string; skill: string }> }) {
  const { plugin: pluginName, skill: name } = use(params);
  const list = useConsole<{ skills: Skill[] }>('/skills');
  // Which plugin, from the URL. Searching every flow for a skill of this name answers a
  // question the address already answered, and answers it differently if two packages ship a
  // skill of one name.
  const plugins = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const plugin = plugins.data?.plugins.find((p) => p.plugin === pluginName);
  const shipped = plugin?.skills.find((x) => x.name === name);
  const known = !plugins.data || !!shipped;

  // What this stage writes and what gates it, from the plugin's own manifest. A table of one
  // flow's stages reports every other flow's as producing nothing and having no gate.
  const produces = plugin?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ') ?? '';
  const gatedHere = plugin?.documents.find((x) => x.stage === name && x.gate);
  const closes = gatedHere ? { name: `approve ${gatedHere.name.replace(/\.md$/, '')}` } : null;

  const skill = list.data?.skills.find((s) => s.name === name);
  const detail = useConsole<SkillDetail>(known ? `/skills/${name}` : null);
  // The skill's own text, so a score on this page is about something the reader can see.
  const text = useConsole<SkillText>(known ? `/plugins/${pluginName}/skills/${name}` : null).data;
  const view = useSkillView(!!text?.references.length);

  // No scores link. An evaluation's subject is a plugin version, so nothing writes a per-skill
  // score, and a scores view nested under a skill would invite a per-skill comparison no ruler
  // supports — every ruler belongs to one plugin.

  return (
    <DashboardPage
      title={name}
      breadcrumb={[
        { label: 'Plugins', href: '/plugins' },
        { label: pluginName, href: `/plugins/${pluginName}` },
        { label: name },
      ]}
      description={text?.description ?? 'One skill: what it costs to run, how a judge scores it, and what that came to.'}
      showPeriod={false}
      updatedAt={freshnessOf(list, plugins, detail)}
      subnav={<SkillViewTabs skill={text} view={view} />}
      // No sibling switcher: every one of the plugin's other skills is a row on the page the
      // breadcrumb goes back to.
      //
      // Four metrics, not eight. These four are what someone asks first; the rest are
      // diagnostics and live in "Where its calls went" below.
      metrics={
        skill
          ? [
              { label: 'Runs', value: formatCount(skill.runs), sublabel: 'recorded' },
              { label: 'Calls per run', value: skill.callsAvg.toFixed(1),
                sublabel: `${formatCount(skill.calls)} total · peak ${skill.callsMax}` },
              { label: 'Duration (median)', value: formatSeconds(skill.durationMedian),
                sublabel: `avg ${formatSeconds(skill.durationAvg)} · longest ${formatSeconds(skill.durationMax)}` },
              { label: 'Refusals',
                value: skill.calls ? `${((skill.refusals / skill.calls) * 100).toFixed(1)}%` : '—',
                sublabel: `${skill.refusals} of ${formatCount(skill.calls)} calls`,
                emphasis: skill.calls > 0 && skill.refusals / skill.calls > 0.05 },
            ]
          : undefined
      }
    >
      <Query query={plugins}>
        {() =>
          !known ? (
            <Panel title="No such skill">
              <EmptyState
                illustration={{ src: '/assets/brand/state-notfound.png', width: 76, height: 96 }}
                icon={<FlaskConical />}
                title={`'${name}' is not shipped by ${pluginName}`}
                description="It may have been renamed, or it belongs to another plugin. The plugin's own page lists everything it ships."
              />
            </Panel>
          ) : (
            <>
              {/* What the skill is, with the verdict beside it. DELIBERATE: not gated on the
                  cost record — a skill's identity is knowable whether or not anybody has run
                  it, and a plugin's front door is precisely the skill with no runs. Version
                  and Evaluated come from that record and say so when it is missing; the rest
                  comes from the catalog. */}
              <Row split={skill ? '1/2' : 'full'}>
                <Panel title="About this skill">
                  <dl className="flex flex-col gap-3 text-[13px]">
                    <Field k="Does" v={<span className="text-ink-soft">{text?.description ?? '—'}</span>} />
                    <Field
                      k="Whose"
                      v={text?.origin === 'theirs'
                        ? <Badge variant="accent" dot>the {pluginName} team&rsquo;s</Badge>
                        : <Badge variant="neutral">ours</Badge>}
                    />
                    <Field k="Position" v={shipped?.isEntry
                      ? `the front door of ${pluginName}`
                      : shipped?.position && plugin
                        ? `${shipped.position} of ${plugin.stages.length} in ${pluginName}`
                        : `shipped by ${pluginName}, not a stage of its method`} />
                    <Field k="Produces" v={produces
                      ? <span className="break-all font-mono text-xs">{produces}</span>
                      : <span className="text-ink-faint">nothing — this skill leaves work, not a document</span>} />
                    <Field
                      k="Closed by"
                      v={closes
                        ? <Badge variant="accent" dot className="whitespace-normal leading-snug">{closes.name} — a person must approve</Badge>
                        : <Badge variant="neutral" className="whitespace-normal leading-snug">no gate — the next step simply follows</Badge>}
                    />
                    <Field k="Version" v={<span className="break-all font-mono text-xs">{skill?.version ?? text?.version ?? '—'}</span>} />
                    {/* The provenance line, rendered verbatim: paraphrasing it would make this
                        page a second claim about ownership rather than a copy of the file's
                        own. */}
                    {text?.source ? (
                      <Field k="Source" v={<span className="break-words text-[12px] leading-relaxed text-ink-soft">{text.source}</span>} />
                    ) : null}
                  </dl>
                </Panel>
                {/* The verdict is derived from the numbers, so a skill with no recorded run
                    gets none rather than an invented one. */}
                {skill ? (
                  <Query query={detail} skeletonRows={3}>
                    {(d) => <Conclusion skill={skill} detail={d} />}
                  </Query>
                ) : null}
              </Row>

              {/* DELIBERATE: not gated on `skill`. The cost record comes from recorded runs,
                  so a skill nobody has called is absent from it — and a front door describing
                  a whole method is exactly such a skill. Gating here renders a header and an
                  empty body for it. The text stands on its own, and the evaluation says
                  "never run" for itself. */}
              <Query query={detail} skeletonRows={6}>
                {(d) => (
                  <>
                    {view === 'read' && text ? <SkillReader skill={text} /> : null}
                    {view === 'references' && text ? <SkillReferences skill={text} /> : null}
                    {view === 'cost' ? <SkillCost skill={skill} detail={d} /> : null}
                  </>
                )}
              </Query>
            </>
          )
        }
      </Query>
    </DashboardPage>
  );
}

/** A label/value line in the identity card, stacked — the card is half the page at most. */
function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

/**
 * The verdict, derived from the numbers on the page rather than stored beside them, so it
 * cannot drift from what the page shows.
 */
function Conclusion({ skill, detail }: { skill: Skill; detail: SkillDetail }) {
  const rate = skill.calls ? (skill.refusals / skill.calls) * 100 : 0;
  const heaviest = detail.surfaces[0];

  return (
    <Panel title="Conclusion" weight="hard">
      <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
        <li>
          <b className="text-ink">Cost.</b> {skill.runs} runs at {skill.callsAvg.toFixed(1)} calls each,
          median {formatSeconds(skill.durationMedian)}, {formatKb(skill.kbPerRun)} per run
          ({skill.mbTotal === null ? '—' : `${skill.mbTotal} MB`} in total).
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
        {/* DELIBERATE: no quality line. The gateway does not send `detail.dimensions` — an
            evaluation's subject is a plugin version, not a skill — so a mean and its weakest
            dimension could only be written from an undefined field. A skill's quality is read
            on its plugin's page, where the ruler lives. */}
      </ul>
    </Panel>
  );
}
