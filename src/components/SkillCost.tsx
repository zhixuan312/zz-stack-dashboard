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
 * What a skill cost to run.
 *
 * No scores: an evaluation's subject is a plugin version, not a skill, so `GET /skills/:name`
 * carries no per-skill score.
 *
 * `skill` is null for one that has never run: the cost list is built from recorded runs, so a
 * skill nobody has called is absent from it. That is a state to render — an unrun skill is the
 * normal condition of one just published.
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
      {/* Never run is a state, not a gap: the cost list is built from recorded runs, so a
          skill nobody has called is absent from it. */}
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
            {/* A call is filed under the last skill served to that caller, and the caller
                key is a person plus a client, not a conversation — so one person working on
                two things has every call filed under whichever skill loaded most recently. */}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Attributed by the last skill served to the caller, not by what the
              skill declares. One person running two conversations at once has
              their calls filed under whichever skill loaded last.
            </p>
            {/* The four demoted metrics: diagnostics rather than headlines, answering "how
                much did it move" as a follow-up to the composition above. */}
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
              /* Not the sum of these rows: the gateway returns the eight busiest tools, and a
                 share of eight would read as a share of all. `surfaces` groups the same tool
                 calls by surface with no limit, so it sums to the true total. */
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
