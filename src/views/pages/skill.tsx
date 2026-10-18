'use client';

import { Activity, Ban, Repeat, RotateCw, Timer } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { AskAbout } from '@/components/patterns/ask-about';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/ui/tabs';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { ReadingBody } from '@/console/reading';
import { useDataClock } from '@/lib/api';
import type { PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { PLUGINS_PATH, readTrouble, type Catalog, type Served } from '@/views/plugins-context';
import { skillContext, skillDetailPath, skillTextPath, skillsPath, type SkillRead } from '@/views/skill-context';
import type { SkillViewName } from '@/views/skill-view';
import { useServed } from '@/views/use-served';

/**
 * One read the console's server made for the page, followed in the browser: its answer until the plugins or skills
 * collection changes or a Retry asks, then the browser's own.
 */
function useFollowed<T>(path: string, served: Served<T> | { state: 'missing'; path: string }) {
  const { q, follow } = useServed<T>(path, true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf(q);
  const trouble = data ? null : failed ?? ((served.state === 'failed' || served.state === 'slow') && !q.isFetching ? readTrouble(served) : null);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, at: q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? served.at : null };
}

/** The four reads, as the page and its tabs both hold them. */
function useSkill(pluginName: string, name: string, served: SkillRead) {
  const catalog = useFollowed<Catalog>(PLUGINS_PATH, served.catalog);
  const list = useFollowed<{ skills: Skill[] }>(skillsPath(pluginName), served.skills);
  const detail = useFollowed<SkillDetail>(skillDetailPath(name), served.detail);
  const text = useFollowed<SkillText>(skillTextPath(pluginName, name), served.text);
  return { catalog, list, detail, text };
}

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
        <Panel title="Calls by door" description={skill.logged ? `${formatCount(skill.calls)} ${plural(skill.calls, 'call')} by your team, ${skill.logged.tools} distinct ${plural(skill.logged.tools, 'tool')}` : `${formatCount(skill.calls)} ${plural(skill.calls, 'call')} by your team, tools not measured`}>
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
        <Panel title="Busiest tools" description="Your team's calls, with the refused ones beside them">
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
 * The page's views, as tabs in the address. Reference is offered only when the skill ships one, or when the address
 * asks for it, so a tab never leads to a view that the address did not name and that holds nothing.
 */
export function SkillTabs({ plugin, skill, view, served }: { plugin: string; skill: string; view: SkillViewName; served: SkillRead }) {
  const { text } = useSkill(plugin, skill, served);
  const refs = text.data?.references.length ?? 0;
  const base = `/plugins/${plugin}/${skill}`;
  return (
    <LinkTabs
      label="Skill views"
      active={view}
      tabs={[
        { key: 'cost', label: 'Its runs', href: base },
        { key: 'read', label: 'The skill', href: `${base}?view=read` },
        ...(refs || view === 'references' ? [{ key: 'references', label: 'Reference', href: `${base}?view=references`, ...(refs ? { count: refs } : {}) }] : []),
      ]}
    />
  );
}

/**
 * One skill a plugin ships: how the active team's runs of it went, the text itself and what ships beside it, read on
 * the console's server and handed here. The view is the address's (`?view=`), as the server read it, so the page's
 * first paint is the view it was asked for, and each one is linkable.
 */
export function SkillView({ plugin: pluginName, skill: name, view, served }: { plugin: string; skill: string; view: SkillViewName; served: SkillRead }) {
  useLive(['plugins', 'skills']);
  const { catalog, list, detail, text } = useSkill(pluginName, name, served);
  const now = useDataClock();
  const plugin: PluginRow | undefined = catalog.data?.plugins.find((p) => p.plugin === pluginName);
  const shipped = plugin?.skills.find((x) => x.name === name);
  // COUPLED: only a SUCCESSFUL read may say a skill is not shipped, and only one that arrived may draw its figures. A
  // failed read is said to have failed, with Retry, never treated as one that shipped the skill or one that did not.
  const failed = catalog.trouble ?? list.trouble;
  const skill = list.data?.skills.find((s) => s.name === name);
  /** The team's runs were read and this skill is not among them: never run, which the tiles and the panel both say. */
  const never = !skill && list.data !== undefined;
  const produces = plugin?.documents.filter((x) => x.stage === name).map((x) => x.name).join(', ');
  const gated = plugin?.documents.find((x) => x.stage === name && x.gate);
  const updatedAt = [catalog.at, list.at, detail.at].filter((x): x is Date | string => x !== null).map((x) => new Date(x)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  useShareView(catalog.data && list.data
    ? skillContext(pluginName, name, { plugin, skill, detail: detail.data, text: text.data, updatedAt, now })
    : pendingContext({ view: 'skill', title: name, address: `/plugins/${pluginName}/${name}`, scope: `your active team's runs of one skill of the ${pluginName} plugin` }, failed));

  if (failed) {
    return (
      <Card>
        <EmptyState kind="error" title="This skill could not be read" className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={() => { catalog.retry(); list.retry(); }}>Retry</Button>}>
          {failed}
        </EmptyState>
      </Card>
    );
  }
  if (catalog.data && !shipped) {
    return (
      <Card>
        <EmptyState kind="filtered" title={`'${name}' is not shipped by ${pluginName}`} className="py-16">It may have been renamed, or it belongs to another plugin. The plugin&apos;s page lists everything it ships.</EmptyState>
      </Card>
    );
  }
  return (
    <Stack>
      {/* The tiles are the runs' summary, and `Its runs` is the tab they belong to. They stand from the first paint:
          they say "never run" in words for a skill the team never ran and `—` for a read that did not answer. */}
      {view === 'cost' ? (
        <Row split="tiles">
          <MetricTile label="Runs" icon={<Repeat />} value={skill ? skill.runs : never ? 0 : '—'} note={never ? 'Never run by your team' : 'By your team'} />
          {/* A skill that has never run has no average calls per run — an average of no runs is undefined, not zero —
              and "0.0" claims a measurement that was never taken. */}
          <MetricTile label="Calls per run" icon={<Activity />} value={never ? 'No runs' : !skill ? '—' : skill.runs ? skill.callsAvg : 'No runs'} format={(n) => n.toFixed(1)} note={never ? 'Nothing has called it' : !skill ? 'Average and peak' : skill.runs ? `${formatCount(skill.calls)} in total, peak ${skill.callsMax}` : 'Nothing has called it'} />
          <MetricTile label="Median run" icon={<Timer />} value={never ? 'Not timed' : !skill ? '—' : skill.durationMedian === null ? 'Not timed' : formatSeconds(skill.durationMedian)} note={skill ? `Longest ${formatSeconds(skill.durationMax)}` : 'And the longest'} />
          <MetricTile label="Refused" icon={<Ban />} value={never ? 'No calls' : !skill ? '—' : skill.calls ? skill.refusals / skill.calls : 'No calls'} format={(n) => `${(n * 100).toFixed(1)}%`} note={skill ? `${skill.refusals} of ${formatCount(skill.calls)} calls` : 'Share of its calls'} />
        </Row>
      ) : null}
      {/* What the skill is: knowable whether or not anybody has run it, and a front door is exactly the skill with no runs. */}
      <div data-protagonist="About this skill" className="contents">
        <Panel title="About this skill" actions={<AskAbout question={`What is ${name} for, and where does it sit in ${pluginName}'s method?`} />}>
          <KeyValue
            columns={2}
            items={[
              { label: 'Whose', value: (text.data?.origin ?? shipped?.origin) === 'theirs' ? <Badge tone="accent">The {pluginName} team&rsquo;s</Badge> : <Badge tone="neutral">Ours</Badge> },
              { label: 'Position', wrap: true, value: shipped?.isEntry ? `The front door of ${pluginName}` : shipped?.position && plugin ? `${shipped.position} of ${plugin.stages.length} in ${pluginName}` : `Shipped by ${pluginName}, not a stage of its method` },
              { label: 'Produces', wrap: true, value: produces ? <span className="font-mono text-xs">{produces}</span> : <span className="text-ink-3">Work, not a document</span> },
              { label: 'Closed by', wrap: true, value: gated ? <Badge tone="accent" dot>approve {gated.name.replace(/\.md$/, '')}</Badge> : <span className="text-ink-3">No gate; the next step follows</span> },
              { label: 'Version', mono: true, value: skill?.version ?? text.data?.version ?? shipped?.version ?? '—' },
              // The provenance line verbatim: a paraphrase would be a second claim about ownership.
              ...(text.data?.source ? [{ label: 'Source', wrap: true, value: text.data.source }] : []),
            ]}
          />
        </Panel>
      </div>
      {view === 'cost' ? (
        detail.data ? <Cost skill={skill} detail={detail.data} />
          : detail.trouble ? (
            <Panel title="Its runs">
              <EmptyState kind="error" title="The runs' record did not load" className="py-10" action={<Button size="sm" icon={<RotateCw />} onClick={detail.retry}>Retry</Button>}>{detail.trouble}</EmptyState>
            </Panel>
          ) : <Skeleton className="h-72 rounded-lg" />
      ) : null}
      {view !== 'cost' && !text.data ? (
        text.trouble ? (
          <Panel title={view === 'read' ? 'The skill' : 'Reference'}>
            <EmptyState kind="error" title="The skill's text did not load" className="py-10" action={<Button size="sm" icon={<RotateCw />} onClick={text.retry}>Retry</Button>}>{text.trouble}</EmptyState>
          </Panel>
        ) : (
          <Panel title={view === 'read' ? 'The skill' : 'Reference'} description="Reading…">
            <Skeleton className="h-72 rounded-lg" />
          </Panel>
        )
      ) : null}
      {view === 'read' && text.data ? <Panel title="The skill" description={`${text.data.body.length.toLocaleString('en-US')} ${plural(text.data.body.length, 'character')}`}><ReadingBody>{text.data.body}</ReadingBody></Panel> : null}
      {/* The address asks for this view, so it is drawn whether or not anything is in it: a tab that leads to a blank
          page is worse than a sentence saying why. */}
      {view === 'references' && text.data && !text.data.references.length ? (
        <Panel title="Reference">
          <EmptyState title="No reference ships with this skill">A reference is the text a skill reads beside its own instructions — a checklist, a schema, a policy. This one ships none.</EmptyState>
        </Panel>
      ) : null}
      {view === 'references' && text.data ? text.data.references.map((r) => (
        <Panel key={r.path} title={r.path} description={`${r.content.length.toLocaleString('en-US')} ${plural(r.content.length, 'character')}`}>
          {r.path.endsWith('.md') ? <ReadingBody>{r.content}</ReadingBody> : <pre className="font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{r.content}</pre>}
        </Panel>
      )) : null}
    </Stack>
  );
}
