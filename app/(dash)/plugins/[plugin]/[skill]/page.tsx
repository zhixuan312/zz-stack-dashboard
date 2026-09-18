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
import { freshnessOf, useConsole, type PluginRow, type Skill, type SkillDetail, type SkillText } from '@/lib/api';

/**
 * LAYER THREE: one skill, read.
 *
 * ONE PAGE WHERE THERE WERE TWO. A flow's skills were judged and unreadable; a block's were
 * countable and unjudged. They are the same kind of thing — text somebody wrote for an agent
 * to load — so this reads the text AND shows what it cost to run, whichever kind ships it.
 *
 * Whose it is leads the page, because it decides what you can do about what you read: a
 * skill marked THEIRS is a block team's own, vendored, and changing it means agreeing a change
 * with them.
 */
export default function PluginSkillPage({ params }: { params: Promise<{ plugin: string; skill: string }> }) {
  const { plugin: pluginName, skill: name } = use(params);
  const list = useConsole<{ skills: Skill[] }>('/skills');
  // WHICH PLUGIN, FROM THE URL. This searched every flow for a skill of this name, which
  // answers a question the address already answered — and answered it differently if two
  // packages ever shipped a skill of one name.
  const plugins = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const plugin = plugins.data?.plugins.find((p) => p.plugin === pluginName);
  const shipped = plugin?.skills.find((x) => x.name === name);
  const known = !plugins.data || !!shipped;

  // WHAT THIS STAGE WRITES AND WHAT CLOSES IT, from the plugin's manifest — never from a table
  // of one method's skills. This page carried a map of ops-flow's six, so every evaluation
  // stage was reported as producing nothing and having no gate, and for zz-skill-define —
  // which writes rulers.md, the gate of its flow — both were false.
  const produces = plugin?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ') ?? '';
  const gatedHere = plugin?.documents.find((x) => x.stage === name && x.gate);
  const closes = gatedHere ? { name: `approve ${gatedHere.name.replace(/\.md$/, '')}` } : null;

  const skill = list.data?.skills.find((s) => s.name === name);
  const detail = useConsole<SkillDetail>(known ? `/skills/${name}` : null);
  // THE SKILL ITSELF. This page could report that sdlc-plan scored 3.42 and never show a line
  // of what sdlc-plan asks for — a score about something the reader cannot see.
  const text = useConsole<SkillText>(known ? `/plugins/${pluginName}/skills/${name}` : null).data;
  const view = useSkillView(!!text?.references.length);

  // THE PER-SKILL SCORES PAGE IS GONE, with the subject it was about. It listed the documents
  // one skill produced and how each was judged; an evaluation's subject is a plugin version
  // now, so nothing can write a per-skill score again. Not relinked at a plugin-level page
  // either: a scores view keyed on a skill and nested under a plugin would invite exactly the
  // per-skill comparison the new design refuses, because every ruler belongs to one plugin.

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
      // NO SIBLING SWITCHER. A strip of the plugin's other skills sat here, and every one of
      // them is a row on the page you just came from — the breadcrumb goes back there in one
      // click. A second copy of a list you have already seen is not navigation.
      //
      // FOUR METRICS, not eight. The page used to open with two rows of cards, which makes
      // eight things equally loud and none of them the headline. These four are what someone
      // asks first; the rest are diagnostics and live in "Where its calls went" below.
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
              {/* WHAT THE SKILL IS, and the verdict beside it; the tab below is the evidence.
                  NOT GATED ON THE COST RECORD. The identity of a skill is knowable whether or
                  not anybody has run it, and the front door is precisely the skill with no
                  runs. Version and Evaluated come from that record and say so when it is
                  missing; the rest comes from the catalog. */}
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
                    {/* THE PROVENANCE LINE, verbatim. It is the sentence that says who owns the
                        content and what of it is ours, and paraphrasing it here would make this
                        page a second claim about ownership rather than a copy of the one the file
                        makes. */}
                    {text?.source ? (
                      <Field k="Source" v={<span className="break-words text-[12px] leading-relaxed text-ink-soft">{text.source}</span>} />
                    ) : null}
                  </dl>
                </Panel>
                {/* THE VERDICT is derived from the numbers, so it needs them. A skill with no
                    recorded run has none, and an invented conclusion would be the one thing on
                    this page nothing stands behind. */}
                {skill ? (
                  <Query query={detail} skeletonRows={3}>
                    {(d) => <Conclusion skill={skill} detail={d} />}
                  </Query>
                ) : null}
              </Row>

              {/* NOT GATED ON `skill`. The cost record comes from recorded runs, so a skill
                  nobody has called is absent from it — and a front door that describes a whole
                  method is exactly such a skill. Gating the page on it rendered a header and an
                  empty body for the one skill most worth reading. The text stands on its own;
                  the evaluation says "never run" for itself. */}
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
 * The verdict, written from the numbers on the page rather than stored beside
 * them. A conclusion in a fixture is a conclusion that stops being true the
 * first time the data moves; this one cannot drift because it is derived.
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
        {/* NO QUALITY LINE. This read a mean and its weakest dimension from
            `detail.dimensions`, which the gateway stopped sending when an evaluation's
            subject became a plugin VERSION rather than a skill — so the paragraph could
            only ever have been written from a field that is now always undefined. A
            skill's quality is read on its plugin's page, where the ruler lives. */}
      </ul>
    </Panel>
  );
}
