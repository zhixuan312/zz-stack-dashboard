'use client';

import { use } from 'react';
import { Activity, Ban, Repeat, Timer } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { AskAbout } from '@/components/patterns/ask-about';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/ui/tabs';
import { sentence } from '@/console/words';
import { plural } from '@/lib/format';
import { ReadingBody } from '@/console/reading';
import { ConsolePage, useArrival } from '@/console/page';
import { Panel } from '@/console/panel';
import { failureOf, Query } from '@/console/query';
import { useAddressParam } from '@/lib/address';
import { freshnessOf, useConsole } from '@/lib/api';
import type { PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { skillContext } from '@/views/skill-context';

type View = 'cost' | 'read' | 'references';

/** How the active team's runs of a skill went, from its recorded runs. A skill the team never called is absent from that record, so never run is a state, not a gap. */
function Cost({ skill, detail }: { skill: Skill | undefined; detail: SkillDetail }) {
  if (!skill) {
    // `data-never-run` is what scripts/primary-data.ts waits for on a skill the team never ran: this sentence is its record.
    return <Panel title="Its runs"><div data-never-run=""><EmptyState title="Never run" className="py-10">Your team has recorded no call against this skill, so there is nothing to measure. Its text is under The skill.</EmptyState></div></Panel>;
  }
  const rate = skill.calls ? (skill.refusals / skill.calls) * 100 : 0;
  const heaviest = detail.surfaces[0];
  return (
    <>
      <Row split="1/2">
        {/* `logged` is null when the platform's log of this skill's calls was not read, and `?? 0` on it printed
            three measured zeros — no tools, no calls, no refusals. The KeyValue below already says "Not measured"
            for the same kind of absence. */}
        <Panel title="Calls by door" description={skill.logged ? `${formatCount(skill.calls)} ${plural(skill.calls, 'call')}, ${skill.logged.tools} distinct ${plural(skill.logged.tools, 'tool')}` : `${formatCount(skill.calls)} ${plural(skill.calls, 'call')}, tools not measured`}>
          <div className="flex flex-col gap-5">
            <CompositionBar label="Calls by door" parts={detail.surfaces.map((x) => ({ label: x.surface, value: x.calls }))} />
            <KeyValue
              columns={2}
              items={[
                { label: 'Observed output per run', value: skill.kbPerRun === null ? 'Not measured' : formatKb(skill.kbPerRun) },
                { label: 'Observed output in total', value: skill.mbTotal === null ? 'Not measured' : `${skill.mbTotal} MB` },
                { label: 'Calls in the log', value: skill.logged ? formatCount(skill.logged.calls) : 'Not measured' },
                { label: 'Refused in the log', value: skill.logged ? formatCount(skill.logged.failed) : 'Not measured' },
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
          <li><b className="text-ink">Runs.</b> {skill.runs} runs at {skill.callsAvg.toFixed(1)} calls each, median {formatSeconds(skill.durationMedian)}, {skill.kbPerRun === null ? 'output not measured' : `${formatKb(skill.kbPerRun)} of observed output`} per run.{heaviest ? <> Most of its calls go to <b className="text-ink">{heaviest.surface}</b> ({formatCount(heaviest.calls)}).</> : null}</li>
          <li><b className="text-ink">Reliability.</b> {rate > 5 ? <>It refuses <b className="text-critical-ink">{rate.toFixed(1)}%</b> of its calls, high enough to be the thing to look at.</> : rate > 0 ? <>A {rate.toFixed(1)}% refusal rate: {skill.refusals} refusals over {formatCount(skill.calls)} calls.</> : 'No refusal recorded.'}</li>
        </ul>
      </Panel>
    </>
  );
}

/**
 * One skill a plugin ships: how the active team's runs of it went, the text itself and what ships beside it. The view
 * is in the address (`?view=`), so each one is linkable; the runs are the default, because they are the reason to open
 * a skill here.
 */
export function SkillView({ params }: { params: Promise<{ plugin: string; skill: string }> }) {
  useLive(['plugins', 'skills']);
  const { plugin: pluginName, skill: name } = use(params);
  const list = useConsole<{ skills: Skill[] }>(`/skills?plugin=${encodeURIComponent(pluginName)}`);
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
  const asked = useAddressParam('view');
  // DECIDED BY THE ADDRESS ALONE, and the `&& refs` that used to be here was a layout defect rather than a guard.
  // `refs` comes from `text`, which is a read — so while it was in flight `view` resolved to `cost`, the page drew the
  // COST view, and when the read landed it swapped wholesale to the references view. Measured at 390px on the phone
  // profile: **CLS 0.228**, with the page shrinking 365px, the card moving 291px and the tab strip 330px, all at
  // ~2.45s. A view whose identity depends on a read is a view that changes under the reader.
  //
  // What the guard was for — not offering a tab that leads nowhere — is kept where it belongs, on the tab itself.
  const view: View = asked === 'read' ? 'read' : asked === 'references' ? 'references' : 'cost';
  /** The team's runs were read and this skill is not among them: never run, which the tiles and the panel both say. */
  const never = !skill && list.data !== undefined;
  const produces = plugin?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ');
  const gated = plugin?.documents.find((x) => x.stage === name && x.gate);
  const base = `/plugins/${pluginName}/${name}`;
  const arrival = useArrival(list, plugins, detail);
  const context = plugins.data && list.data
    ? skillContext(pluginName, name, { plugin, skill, detail: detail.data, text, ...arrival })
    : pendingContext({ view: 'skill', title: name, address: base, scope: `your active team's runs of one skill of the ${pluginName} plugin` }, failed);

  return (
    <ConsolePage
      title={name}
      crumbs={[{ label: 'Plugins', href: '/plugins' }, { label: pluginName, href: `/plugins/${pluginName}` }]}
      // A sentence first, always — see teams/[slug]/page.tsx. The skill's own words follow it.
      description={<span className="inline-flex flex-wrap items-center gap-2">One skill a plugin ships: how your team&rsquo;s runs of it went, the text itself, and what ships beside it.{text?.description ? ` ${sentence(text.description)}` : null}</span>}
      showPeriod={false}
      updatedAt={freshnessOf(list, plugins, detail)}
      context={context}
      toolbar={known ? <LinkTabs label="Skill views" active={view} tabs={[{ key: 'cost', label: 'Its runs', href: base }, { key: 'read', label: 'The skill', href: `${base}?view=read` }, ...(refs || asked === 'references' ? [{ key: 'references', label: 'Reference', href: `${base}?view=references`, ...(refs ? { count: refs } : {}) }] : [])]} /> : undefined}
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
          {/* The tiles are the runs' summary, and `Its runs` is the tab they belong to. They were rendered for every
              tab, under the tab strip, so a reader who picked `The skill` met four cost figures and a colophon before a
              line of the text — the strip appeared to govern them, and on two of its three tabs it did not. */}
          {/* The tiles stand from the first paint, as on every page: they say "never run" in words for a skill the team
              never ran and `—` for a read that did not answer. The row vanishing when the read came back without the
              skill moved everything under it up (CLS 0.218 at 390px). */}
          {view === 'cost' ? (
            <Row split="tiles">
              <MetricTile label="Runs" icon={<Repeat />} value={skill ? skill.runs : never ? 0 : list.isPending ? '…' : '—'} note={never ? 'Never run by your team' : 'Recorded'} />
              {/* The empty state in words, like the two beside it: "Not timed" for a median nobody measured, "No calls" for a share
                of nothing. A skill that has never run has no average calls per run — an average of no runs is undefined, not
                zero — and "0.0" claims a measurement that was never taken. */}
              <MetricTile label="Calls per run" icon={<Activity />} value={never ? 'No runs' : !skill ? (list.isPending ? '…' : '—') : skill.runs ? skill.callsAvg : 'No runs'} format={(n) => n.toFixed(1)} note={never ? 'Nothing has called it' : !skill ? 'Average and peak' : skill.runs ? `${formatCount(skill.calls)} in total, peak ${skill.callsMax}` : 'Nothing has called it'} />
              <MetricTile label="Median run" icon={<Timer />} value={never ? 'Not timed' : !skill ? (list.isPending ? '…' : '—') : skill.durationMedian === null ? 'Not timed' : formatSeconds(skill.durationMedian)} note={skill ? `Longest ${formatSeconds(skill.durationMax)}` : 'And the longest'} />
              <MetricTile label="Refused" icon={<Ban />} value={never ? 'No calls' : !skill ? (list.isPending ? '…' : '—') : skill.calls ? skill.refusals / skill.calls : 'No calls'} format={(n) => `${(n * 100).toFixed(1)}%`} note={skill ? `${skill.refusals} of ${formatCount(skill.calls)} calls` : 'Share of its calls'} />
            </Row>
          ) : null}
          {/* What the skill is: knowable whether or not anybody has run it, and a front door is exactly the skill with no runs. */}
          <Panel title="About this skill" actions={<AskAbout iconBelowSm question={`What is ${name} for, and where does it sit in ${pluginName}'s method?`} />}>
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
          {view === 'cost' ? <Query query={detail} what="The runs' record" skeleton={<Skeleton className="h-72 rounded-lg" />}>{(d) => <Cost skill={skill} detail={d} />}</Query> : null}
          {/* The room, held while the read is in flight — and the second half of a fix whose first half was wrong.
              **This placeholder was written to fix `?view=references`'s CLS 0.228 on the theory that the whole stack of
              panels appeared at once, and it changed nothing: 0.228 stayed 0.228.** A probe with a layout-shift observer
              under the phone profile showed why — `reading=false` for the whole load, because this condition could
              never be true. `view` resolved to `cost` until `refs` was known, so the page drew the COST view and then
              swapped wholesale to the references view when the read landed. **The cause was the view's identity, not
              the panels' arrival**; `view` now follows the address and this holds the room while the read is in flight.
              Kept because it is now reachable and doing its job — the second measurement reads 0.040. */}
          {!text && (view === 'read' || view === 'references') ? (
            <Panel title={view === 'read' ? 'The skill' : 'Reference'} description="Reading…">
              <div className="flex flex-col gap-(--stack-gap)">
                <Skeleton className="h-72 rounded-lg" />
                {view === 'references' ? <Skeleton className="h-72 rounded-lg" /> : null}
              </div>
            </Panel>
          ) : null}
          {view === 'read' && text ? <Panel title="The skill" description={`${text.body.length.toLocaleString('en-US')} ${plural(text.body.length, 'character')}`}><ReadingBody>{text.body}</ReadingBody></Panel> : null}
          {/* The address asks for this view, so it is drawn whether or not anything is in it — a tab that leads to a
              blank page is worse than a sentence saying why. Before `view` followed the address this could not
              happen; now it can, so it says so. */}
          {view === 'references' && text && !text.references.length ? (
            <Panel title="Reference">
              <EmptyState title="No reference ships with this skill">A reference is the text a skill reads beside its own instructions — a checklist, a schema, a policy. This one ships none.</EmptyState>
            </Panel>
          ) : null}
          {view === 'references' && text ? text.references.map((r) => (
            <Panel key={r.path} title={r.path} description={`${r.content.length.toLocaleString('en-US')} ${plural(r.content.length, 'character')}`}>
              {r.path.endsWith('.md') ? <ReadingBody>{r.content}</ReadingBody> : <pre className="font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{r.content}</pre>}
            </Panel>
          )) : null}
        </>
      )}
    </ConsolePage>
  );
}
