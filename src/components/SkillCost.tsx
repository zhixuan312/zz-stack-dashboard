'use client';

import { FlaskConical } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';
import { EmptyState, Row } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCount, formatKb } from '@/lib/format';
import type { Skill, SkillDetail } from '@/lib/api-shapes';

/**
 * WHAT A SKILL COST TO RUN.
 *
 * NO SCORES, AND THERE CANNOT BE ANY. This also drew a rubric, its dimensions and the
 * judge's recurring findings, from `detail.dimensions` and `detail.findings` — fields
 * `GET /skills/:name` stopped sending when an evaluation's subject became a PLUGIN VERSION
 * rather than a skill. Nothing can ever write a per-skill score again. The reads were left
 * standing, so `d.findings` was `undefined` and every skill with a recorded run threw on the
 * route error boundary instead of rendering: the page was unreachable, and the "No rubric
 * yet" empty state written for this case sat below the line that crashed.
 *
 * `skill` is null for one that has never run: the cost list is built from recorded runs,
 * so a skill nobody has called is genuinely absent from it. That is a state to render,
 * not a crash — an unrun skill is the normal condition of one a block team has just
 * published.
 *
 * `scoresHref` is optional because only a document-producing skill has documents to
 * list. A block's skills produce none, so there is nothing for that page to link to.
 */
export function SkillCost({
  skill, detail,
}: {
  skill: Skill | undefined;
  detail: SkillDetail;
}) {
  const d = detail;
  return (
    <>
      {/* NEVER RUN is a state, not a gap. The cost list is built from recorded runs, so
          a skill nobody has called is genuinely absent from it — which is the normal
          condition of one a block team has just published, and of every step of a flow
          nobody has installed. Saying so beats four dashes. */}
      {!skill ? (
        <Panel title="Cost to run">
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
            title="Calls by door"
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
