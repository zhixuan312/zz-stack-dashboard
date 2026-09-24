'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TabBar } from '@/components/ui/tab-bar';
import type { SkillText } from '@/lib/api-shapes';

type SkillView = 'read' | 'references' | 'cost';

/** Which view of a skill is being read, from the URL. Defaults to the cost: the reason to open a
 *  skill is usually to see how it is doing.
 *
 *  `hasReferences` decides whether the third view exists at all. Asked for on a skill that ships
 *  none — by a stale link, or a hand-typed URL — it falls back rather than rendering a tab that is
 *  not on the bar. */
export function useSkillView(hasReferences: boolean): SkillView {
  const v = useSearchParams().get('view');
  if (v === 'read') return 'read';
  if (v === 'references' && hasReferences) return 'references';
  return 'cost';
}

/**
 * Three views of one skill, because they are three different questions:
 *
 *   cost        what it cost to run — the default
 *   read        what it says
 *   references  what ships beside it
 *
 * A skill runs to five thousand characters and its references to as many again, so stacked the cost
 * sits below ten thousand characters of prose with nothing on screen saying it is there.
 *
 * The URL is the state, like the period and version pickers, so a view of a skill is linkable.
 */
export function SkillViewTabs({ skill, view }: { skill: SkillText | undefined; view: SkillView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const q = new URLSearchParams(params.toString());
    // The DEFAULT view carries no parameter, so the plain URL is the one people share.
    if (next === 'cost') q.delete('view');
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
        { id: 'cost', label: 'Cost to run' },
        { id: 'read', label: 'The skill' },
        // Only where there is something. Few skills ship material beside their SKILL.md; a tab
        // present on every page and useful on a few teaches a reader to stop looking at it. Its presence is the signal, and the count says how much before the click.
        ...(refs ? [{ id: 'references', label: `Reference · ${refs}` }] : []),
      ]}
    />
  );
}
