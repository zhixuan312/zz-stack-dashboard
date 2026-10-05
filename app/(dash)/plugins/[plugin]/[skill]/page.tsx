'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Activity, Ban, Repeat, Timer } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/ui/tabs';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { failureOf, Query } from '@/console/query';
import { freshnessOf, useConsole } from '@/lib/api';
import type { PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { formatCount, formatKb, formatSeconds } from '@/lib/format';

type View = 'cost' | 'read' | 'references';

// The markdown renderer arrives only with the views that read text: the cost view, the default, never needs it.
const Prose = dynamic(() => import('@/components/patterns/prose').then((m) => m.Prose), { loading: () => <Skeleton className="h-64 rounded-md" /> });

/** What a skill costs to run, from its recorded runs. A skill nobody has called is absent from that record, so never run is a state, not a gap. */
function Cost({ skill, detail }: { skill: Skill | undefined; detail: SkillDetail }) {
  if (!skill) {
    return <Panel title="Cost to run"><EmptyState title="Never run" className="py-10">No call has been recorded against this skill, so there is nothing to cost. Its text is under The skill.</EmptyState></Panel>;
  }
  const rate = skill.calls ? (skill.refusals / skill.calls) * 100 : 0;
  const heaviest = detail.surfaces[0];
  return (
    <>
      <Row split="1/2">
        <Panel title="Calls by door" description={`${formatCount(skill.calls)} calls, ${skill.logged?.tools ?? 0} distinct tools`}>
          <div className="flex flex-col gap-5">
            <CompositionBar label="Calls by door" parts={detail.surfaces.map((x) => ({ label: x.surface, value: x.calls }))} />
            <KeyValue
              columns={2}
              items={[
                { label: 'Payload per run', value: formatKb(skill.kbPerRun) },
                { label: 'Payload in total', value: skill.mbTotal === null ? 'Not measured' : `${skill.mbTotal} MB` },
                { label: 'Calls in the log', value: formatCount(skill.logged?.calls ?? 0) },
                { label: 'Refused in the log', value: formatCount(skill.logged?.failed ?? 0) },
              ]}
            />
            {/* A call is filed under the last skill served to the caller, and the caller is a person plus a client, not a conversation. */}
            <p className="t-caption">Attributed by the last skill served to the caller, not by what the skill declares: one person running two conversations at once has their calls filed under whichever skill loaded last.</p>
          </div>
        </Panel>
        <Panel title="Busiest tools" description="Calls, with the refused ones beside them">
          {/* A share of all calls, not of these rows: the gateway sends the eight busiest tools, and the doors sum to the whole. */}
          <BarList label="Busiest tools" limit={8} format={formatCount} total={detail.surfaces.reduce((n, s) => n + s.calls, 0)} items={detail.busiestTools.map((t) => ({ key: t.tool, label: <span className="font-mono text-xs">{t.tool}</span>, value: t.calls, meta: t.failed ? `${t.failed} refused` : undefined }))} />
        </Panel>
      </Row>
      <Panel title="Conclusion">
        <ul className="t-small flex flex-col gap-2 text-ink-2">
          <li><b className="text-ink">Cost.</b> {skill.runs} runs at {skill.callsAvg.toFixed(1)} calls each, median {formatSeconds(skill.durationMedian)}, {formatKb(skill.kbPerRun)} per run.{heaviest ? <> Most of its calls go to <b className="text-ink">{heaviest.surface}</b> ({formatCount(heaviest.calls)}).</> : null}</li>
          <li><b className="text-ink">Reliability.</b> {rate > 5 ? <>It refuses <b className="text-critical-ink">{rate.toFixed(1)}%</b> of its calls, high enough to be the thing to look at.</> : rate > 0 ? <>A {rate.toFixed(1)}% refusal rate: {skill.refusals} refusals over {formatCount(skill.calls)} calls.</> : 'No refusal recorded.'}</li>
        </ul>
      </Panel>
    </>
  );
}

/**
 * One skill a plugin ships: what it costs to run, the text itself and what ships beside it. The view is in the
 * address (`?view=`), so each one is linkable; cost is the default, because it is the reason to open a skill here.
 */
export default function PluginSkillPage({ params }: { params: Promise<{ plugin: string; skill: string }> }) {
  const { plugin: pluginName, skill: name } = use(params);
  const list = useConsole<{ skills: Skill[] }>('/skills');
  const plugins = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const plugin = plugins.data?.plugins.find((p) => p.plugin === pluginName);
  const shipped = plugin?.skills.find((x) => x.name === name);
  // COUPLED: only a SUCCESSFUL read may say a skill is not shipped, and only one that arrived may
  // draw its figures. `known = !plugins.data || !!shipped` treated a FAILED read as one that
  // shipped the skill: the page drew `…` tiles for ever, never said the read had failed, and said
  // nothing that would send a reader to look again. The sibling page made the mirror-image
  // mistake, reporting a failed read as "not a plugin the console lists".
  const failed = failureOf(plugins) ?? failureOf(list);
  const known = !plugins.data || !!shipped;
  const skill = list.data?.skills.find((s) => s.name === name);
  const detail = useConsole<SkillDetail>(known ? `/skills/${name}` : null);
  const text = useConsole<SkillText>(known ? `/plugins/${pluginName}/skills/${name}` : null).data;
  const refs = text?.references.length ?? 0;
  const asked = useSearchParams().get('view');
  const view: View = asked === 'read' ? 'read' : asked === 'references' && refs ? 'references' : 'cost';
  const produces = plugin?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ');
  const gated = plugin?.documents.find((x) => x.stage === name && x.gate);
  const base = `/plugins/${pluginName}/${name}`;

  return (
    <ConsolePage
      title={name}
      crumbs={[{ label: 'Plugins', href: '/plugins' }, { label: pluginName, href: `/plugins/${pluginName}` }]}
      description={text ? text.description ?? 'A skill with no description of its own.' : known ? <Skeleton className="block h-10 w-full max-w-[60ch]" /> : undefined}
      showPeriod={false}
      updatedAt={freshnessOf(list, plugins, detail)}
      toolbar={known ? <LinkTabs label="Skill views" active={view} tabs={[{ key: 'cost', label: 'Cost to run', href: base }, { key: 'read', label: 'The skill', href: `${base}?view=read` }, ...(refs ? [{ key: 'references', label: 'Reference', href: `${base}?view=references`, count: refs }] : [])]} /> : undefined}
    >
      {failed ? (
        <EmptyState kind="error" title="This skill could not be read" className="py-16"
                    action={<Button size="sm" onClick={() => { void plugins.refetch(); void list.refetch(); }}>Retry</Button>}>
          {failed}
        </EmptyState>
      ) : !known ? (
        <EmptyState kind="filtered" title={`'${name}' is not shipped by ${pluginName}`} className="py-16">It may have been renamed, or it belongs to another plugin. The plugin&apos;s page lists everything it ships.</EmptyState>
      ) : (
        <>
          {skill || list.isPending ? (
            <Row split="tiles">
              <MetricTile label="Runs" icon={<Repeat />} value={skill ? skill.runs : list.isPending ? '…' : '—'} note="Recorded" />
              <MetricTile label="Calls per run" icon={<Activity />} value={skill ? skill.callsAvg : list.isPending ? '…' : '—'} format={(n) => n.toFixed(1)} note={skill ? `${formatCount(skill.calls)} in total, peak ${skill.callsMax}` : 'Average and peak'} />
              <MetricTile label="Median run" icon={<Timer />} value={!skill ? (list.isPending ? '…' : '—') : skill.durationMedian === null ? 'Not timed' : formatSeconds(skill.durationMedian)} note={skill ? `Longest ${formatSeconds(skill.durationMax)}` : 'And the longest'} />
              <MetricTile label="Refused" icon={<Ban />} value={!skill ? (list.isPending ? '…' : '—') : skill.calls ? skill.refusals / skill.calls : 'No calls'} format={(n) => `${(n * 100).toFixed(1)}%`} note={skill ? `${skill.refusals} of ${formatCount(skill.calls)} calls` : 'Share of its calls'} />
            </Row>
          ) : null}
          {/* What the skill is: knowable whether or not anybody has run it, and a front door is exactly the skill with no runs. */}
          <Panel title="About this skill">
            <KeyValue
              columns={2}
              items={[
                { label: 'Whose', value: text?.origin === 'theirs' ? <Badge tone="accent">The {pluginName} team&rsquo;s</Badge> : <Badge tone="neutral">Ours</Badge> },
                { label: 'Position', wrap: true, value: shipped?.isEntry ? `The front door of ${pluginName}` : shipped?.position && plugin ? `${shipped.position} of ${plugin.stages.length} in ${pluginName}` : `Shipped by ${pluginName}, not a stage of its method` },
                { label: 'Produces', wrap: true, value: produces ? <span className="font-mono text-xs">{produces}</span> : <span className="text-ink-3">Work, not a document</span> },
                { label: 'Closed by', wrap: true, value: gated ? <Badge tone="accent" dot>approve {gated.name.replace(/\.md$/, '')}</Badge> : <span className="text-ink-3">No gate; the next step follows</span> },
                { label: 'Version', mono: true, value: skill?.version ?? text?.version ?? '—' },
                // The provenance line verbatim: a paraphrase would be a second claim about ownership.
                ...(text?.source ? [{ label: 'Source', wrap: true, value: text.source }] : []),
              ]}
            />
          </Panel>
          {view === 'cost' ? <Query query={detail} what="The cost record" skeleton={<Skeleton className="h-72 rounded-lg" />}>{(d) => <Cost skill={skill} detail={d} />}</Query> : null}
          {view === 'read' && text ? <Panel title="The skill" description={`${text.body.length.toLocaleString('en-US')} characters`}><Prose>{text.body}</Prose></Panel> : null}
          {view === 'references' && text ? text.references.map((r) => (
            <Panel key={r.path} title={r.path} description={`${r.content.length.toLocaleString('en-US')} characters`}>
              {r.path.endsWith('.md') ? <Prose>{r.content}</Prose> : <pre className="font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{r.content}</pre>}
            </Panel>
          )) : null}
        </>
      )}
    </ConsolePage>
  );
}
