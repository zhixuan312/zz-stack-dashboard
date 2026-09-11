'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TabBar } from '@/components/ui/tab-bar';
import type { SkillText } from '@/lib/api';

type SkillView = 'read' | 'references' | 'evaluation';

/** Which view of a skill is being read, from the URL. Defaults to the evaluation:
 *  the reason to open a skill is usually to see how it is doing, and the text is one
 *  click away for the times it is not.
 *
 *  `hasReferences` decides whether the third view exists at all. Asked for on a skill
 *  that ships none — by a stale link, or a hand-typed URL — it falls back rather than
 *  rendering a tab that is not on the bar. */
export function useSkillView(hasReferences: boolean): SkillView {
  const v = useSearchParams().get('view');
  if (v === 'read') return 'read';
  if (v === 'references' && hasReferences) return 'references';
  return 'evaluation';
}

/**
 * THREE VIEWS OF ONE SKILL, because they are three different questions and stacking
 * them made a page nobody reaches the bottom of.
 *
 *   evaluation  what it cost and what it scored — the default
 *   read        what it says
 *   references  what ships beside it
 *
 * A skill runs to five thousand characters and its references to as many again, so the
 * evaluation sat below ten thousand characters of prose with nothing on screen saying it
 * was there. The tab bar says it is.
 *
 * THE URL IS THE STATE, like the period and version pickers — a view of a skill is then
 * linkable, and "look at what ops-plan scored" is a link rather than an instruction.
 */
export function SkillViewTabs({ skill, view }: { skill: SkillText | undefined; view: SkillView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const q = new URLSearchParams(params.toString());
    // The DEFAULT view carries no parameter, so the plain URL is the one people share.
    if (next === 'evaluation') q.delete('view');
    else q.set('view', next);
    const query = q.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const refs = skill?.references.length ?? 0;
  return (
    <TabBar
      className="bg-surface"
      activeTab={view}
      onTabChange={onChange}
      tabs={[
        { id: 'evaluation', label: 'Evaluation' },
        { id: 'read', label: 'The skill' },
        // ONLY WHERE THERE IS SOMETHING. Two skills in the whole catalog ship material
        // beside their SKILL.md; on every other one this tab opened to a paragraph
        // explaining that it was empty. A tab present on every page and useful on two
        // teaches a reader to stop looking at it — so its presence is the signal now,
        // and the count says how much before the click.
        ...(refs ? [{ id: 'references', label: `Reference · ${refs}` }] : []),
      ]}
    />
  );
}
