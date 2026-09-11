'use client';

import { use } from 'react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge } from '@/components/ui';
import { SkillReader } from '@/components/SkillReader';
import { SkillReferences } from '@/components/SkillReferences';
import { SkillEvaluation } from '@/components/SkillEvaluation';
import { SkillViewTabs, useSkillView } from '@/components/SkillViewTabs';
import { useConsole, type Skill, type SkillDetail, type SkillText } from '@/lib/api';

/**
 * LAYER THREE: one of a block's skills, read.
 *
 * The console could say casebox carried four skills and not a word of what any one said.
 * A block's skills ARE its method — the part a block team publishes so nobody has to
 * rediscover their platform by trial and error — so the useful thing to do with one
 * is read it.
 *
 * Whose it is leads, because it decides what you can do about what you read: a skill
 * marked THEIRS is the block team's own, vendored, and changing it means agreeing a
 * change with them.
 */
export default function BlockSkillPage({ params }: { params: Promise<{ block: string; skill: string }> }) {
  const { block, skill } = use(params);
  const q = useConsole<SkillText>(`/blocks/${block}/skills/${skill}`);
  // THE SAME TWO HALVES AS A FLOW'S SKILL. A block's skills were countable and
  // unjudged while a flow's were judged and unreadable; they are the same kind of
  // thing, so both pages read the text AND show what it cost and scored. The cost
  // list is keyed by name and a skill nobody has run is absent from it, which the
  // evaluation renders as "never run" rather than as a hole.
  const list = useConsole<{ skills: Skill[] }>('/skills');
  const stats = list.data?.skills.find((x) => x.name === skill);
  const detail = useConsole<SkillDetail>(`/skills/${skill}`);
  const view = useSkillView(!!q.data?.references.length);

  return (
    <DashboardPage
      title={skill}
      breadcrumb={[
        { label: 'Blocks', href: '/blocks' },
        { label: block, href: `/blocks/${block}` },
        { label: skill },
      ]}
      description={q.data?.description ?? undefined}
      showPeriod={false}
      updatedAt={new Date()}
      subnav={<SkillViewTabs skill={q.data} view={view} />}
      rail={
        q.data ? (
          <div className="flex flex-col gap-4">
            <Panel title="What this skill is">
              <dl className="flex flex-col gap-3 text-[13px]">
                <Row
                  k="Whose"
                  v={q.data.origin === 'theirs'
                    ? <Badge variant="accent" dot>the {block} team&rsquo;s</Badge>
                    : <Badge variant="neutral">ours</Badge>}
                />
                <Row k="Version" v={<span className="font-mono text-xs">{q.data.version ?? '—'}</span>} />
                {q.data.whenToUse ? (
                  <Row k="When to use" v={<span className="text-ink-soft">{q.data.whenToUse}</span>} />
                ) : null}
                {/* THE PROVENANCE LINE, verbatim. It is the sentence that says who owns
                    the content and what of it is ours, and paraphrasing it here would
                    make this page a second claim about ownership rather than a copy of
                    the one the file makes. */}
                {q.data.source ? (
                  <Row k="Source" v={<span className="text-[12px] leading-relaxed text-ink-soft">{q.data.source}</span>} />
                ) : null}
              </dl>
            </Panel>
          </div>
        ) : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <>
            {view === 'read' ? <SkillReader skill={d} /> : null}
            {view === 'references' ? <SkillReferences skill={d} /> : null}
            {/* NO SCORES LINK. That page lists the documents a skill produced, and a
                block's skills produce none — they are read before a call, not written
                into a store. */}
            {view === 'evaluation' ? (
              <Query query={detail} skeletonRows={4}>
                {(dd) => <SkillEvaluation skill={stats} detail={dd} />}
              </Query>
            ) : null}

          </>
        )}
      </Query>
    </DashboardPage>
  );
}

/** A label/value line in the rail, stacked — the rail is a third of the page. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
