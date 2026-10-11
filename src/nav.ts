import { nav } from '@/app.config';
import type { NavGroup } from '@/app.config';
import type { ConsoleMode } from '@/lib/api';

/**
 * The rail for one mode: `nav` in `src/app.config.ts` narrowed to what this person and this scope may see.
 *
 * A pure function over the config rather than a filter inlined in the rail, so what a member actually sees is a question
 * a test can ask directly. A group whose items all drop away goes with them, and its eyebrow becomes `teamLabel` where
 * "Platform" would name the wrong owner.
 */
export function navGroups(mode: ConsoleMode): NavGroup[] {
  return nav.flatMap((section) => {
    const items = mode === 'platform' ? section.items : section.items.filter((i) => !i.platformOnly);
    if (!items.length) return [];
    const label = mode === 'platform' ? section.label : section.teamLabel ?? section.label;
    return [{ label, items: items.map(({ href, label: l, icon, badge }) => ({ href, label: l, icon, badge })) }];
  });
}
