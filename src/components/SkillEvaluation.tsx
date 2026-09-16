'use client';

import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { Panel } from '@/components/Panel';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';
import {
  Badge, EmptyState, PageControl, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, usePaged,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCount, formatKb } from '@/lib/format';
import type { Skill, SkillDetail } from '@/lib/api';

/**
 * WHAT A SKILL COST AND WHAT IT SCORED — shared by both skill pages.
 *
 * A block's skills were countable and unjudged; a flow's were judged and unreadable.
 * They are the same kind of thing, so every skill carries both halves.
 *
 * `skill` is null for one that has never run: the cost list is built from recorded runs,
 * so a skill nobody has called is genuinely absent from it. That is a state to render,
 * not a crash — an unrun skill is the normal condition of one a block team has just
 * published.
 *
 * `scoresHref` is optional because only a document-producing skill has documents to
 * list. A block's skills produce none, so there is nothing for that page to link to.
 */
export function SkillEvaluation({
  skill, detail, scoresHref,
}: {
  skill: Skill | undefined;
  detail: SkillDetail;
  scoresHref?: string;
}) {
  const d = detail;
  const { page: findings, controls } = usePaged(d.findings);
  return (
    <>
      {/* NEVER RUN is a state, not a gap. The cost list is built from recorded runs, so
          a skill nobody has called is genuinely absent from it — which is the normal
          condition of one a block team has just published, and of every step of a flow
          nobody has installed. Saying so beats four dashes. */}
      {!skill ? (
        <Panel title="What it costs to run">
          <EmptyState
            illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
            icon={<FlaskConical />}
            title="Never run"
            description="No call has been recorded against this skill, so there is nothing to cost. It exists, its text is under The skill, and nobody has used it yet."
          />
        </Panel>
      ) : (
        <Row split="1/2">
          <Panel
            title="Where its calls went"
            aside={`${formatCount(skill.calls)} calls · ${skill.logged?.tools ?? 0} distinct tools`}
          >
            <CompositionBar
              slices={d.surfaces.map((x) => ({ key: x.surface, label: x.surface, value: x.calls }))}
            />
            {/* SAY WHAT THE ATTRIBUTION IS. A call is filed under the last
                skill served to that caller, and the caller key is a person
                plus a client — not a conversation. So one person working on
                two things at once has every call filed under whichever skill
                loaded most recently, and ops-intent shows block calls it
                could not have made. The number is real; what it is a number
                OF is the thing that needed saying. */}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Attributed by the last skill served to the caller, not by what the
              skill declares. One person running two conversations at once has
              their calls filed under whichever skill loaded last.
            </p>
            {/* The four demoted metrics. Diagnostics, not headlines — they
                answer "how much did it move", which is a follow-up to the
                composition above rather than a question of its own. */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              <Mini
                k="Payload per run"
                v={formatKb(skill.kbPerRun)}
                sub={skill.mbTotal === null ? 'not measured' : `${skill.mbTotal} MB in total`}
              />
              <Mini k="Distinct tools" v={String(skill.logged?.tools ?? '—')} sub="named at least once" />
              <Mini k="Calls in the log" v={formatCount(skill.logged?.calls ?? 0)}
                sub={`${skill.logged?.failed ?? 0} refused`} />
              {/* Never a zero. See the API: turns are recorded as loose
                  events with no run id, so "0" would read as "this skill
                  used no LLM turns", which is false rather than unknown. */}
              <Mini k="LLM turns" v={skill.turns === null ? '—' : formatCount(skill.turns)}
                sub={skill.turns === null ? 'not linked to a run' : 'attributed'}
                muted={skill.turns === null} />
            </div>
          </Panel>

          <Panel title="Busiest tools" aside="calls, and how many were refused">
            <BarList
              /* NOT the sum of these rows: the gateway returns the eight busiest tools,
                 and a share of eight would read as a share of all. `surfaces` groups the
                 same tool calls by surface with no limit, so it sums to the true total. */
              total={d.surfaces.reduce((n, s) => n + s.calls, 0)}
              rows={d.busiestTools.map((t) => ({
                key: t.tool,
                label: <span className="break-all font-mono text-xs">{t.tool}</span>,
                value: t.calls,
                caption: t.failed ? `${t.failed} refused` : undefined,
                tint: t.failed / t.calls > 0.2 ? 'rose' : t.failed ? 'amber' : undefined,
              }))}
            />
          </Panel>
        </Row>
      )}

      {d.dimensions.length ? (
        <Panel
          title="How it is judged"
          aside={skill?.evaluated
            ? `${d.dimensions.length} dimensions · judge ${skill.evaluated.judge}`
            : undefined}
          padded={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>What a 5 looks like</TableHead>
                <TableHead>What a 1 looks like</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.dimensions.map((x) => (
                <TableRow key={x.name}>
                  <TableCell className="w-[22%] break-words font-medium text-ink">{x.name}</TableCell>
                  <TableCell className="text-xs"><b className="text-[var(--sage-deep)]">5 —</b> {x.fiveMeans}</TableCell>
                  <TableCell className="text-xs"><b className="text-[var(--rose-deep)]">1 —</b> {x.oneMeans}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Panel title="How it is judged">
          <EmptyState
            illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
            icon={<FlaskConical />}
            title="No rubric yet"
            description={`${d.skill} has never been evaluated — no rubric, no judge run, no score. The statistics on this page are real; there is simply nothing to compare them against.${
              d.skill === 'ops-build'
                ? ' For ops-build that is structural: it produces side effects in other systems, not a document a judge can read.'
                : ''
            }`}
          />
        </Panel>
      )}

      {d.dimensions.length ? (
        <Panel
          title="What it scored"
          aside={
            // THE WAY IN, where there is one. These means are computed over the
            // documents a judge happened to read, and this panel never said which
            // — or how many it did not read. Absent for a block's skills: they
            // produce no document, so there is no list of documents to link to.
            scoresHref ? (
              <Link href={scoresHref} className="font-medium text-accent hover:underline">
                every document, scored or not →
              </Link>
            ) : undefined
          }
          padded={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead className="text-right">Mean</TableHead>
                <TableHead hideBelow="md" className="text-right">SD</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead hideBelow="md" className="text-right">≤1</TableHead>
                <TableHead hideBelow="md" className="text-right">≥4</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.dimensions.map((x) => (
                <TableRow key={x.name}>
                  <TableCell className="break-words font-medium text-ink">
                    {x.name}
                    {x.n > 0 && x.n < 8 ? (
                      <Badge variant="neutral" className="ml-2">n={x.n} — directional only</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {x.mean?.toFixed(2) ?? '—'}
                  </TableCell>
                  <TableCell hideBelow="md" className="text-right tabular-nums text-xs">{x.sd?.toFixed(2) ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{x.n}</TableCell>
                  <TableCell hideBelow="md" className="text-right tabular-nums text-xs text-[var(--rose-deep)]">{x.low || '—'}</TableCell>
                  <TableCell hideBelow="md" className="text-right tabular-nums text-xs text-[var(--sage-deep)]">{x.high}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}

      {d.findings.length ? (
        <Panel
          title="What the judge kept finding"
          aside="patterns across many documents · none acted on yet"
          padded={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="text-right font-medium tabular-nums">{f.docs_affected}</TableCell>
                  <TableCell className="max-w-[70ch] break-words text-[13px] text-ink">{f.pattern}</TableCell>
                  <TableCell><Badge variant="amber" dot>{f.decision ?? 'open'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PageControl {...controls} />
        </Panel>
      ) : null}
    </>
  );
}

/** A small label/value pair for the diagnostics strip. */
function Mini({ k, v, sub, muted }: { k: string; v: string; sub?: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</span>
      <span className={cn('text-lg font-semibold tabular-nums', muted ? 'text-ink-faint' : 'text-ink')}>{v}</span>
      {sub ? <span className="text-[11px] text-ink-faint">{sub}</span> : null}
    </div>
  );
}
