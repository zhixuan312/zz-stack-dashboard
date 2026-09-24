import { BookOpen, History, Sparkles } from 'lucide-react';
import { NavTabs } from '@/components/ui/nav-tabs';

type KnowledgeView = 'nodes' | 'ask' | 'log';

/**
 * The knowledge base's three views, as real routes.
 *
 * DELIBERATE: not `?view=` on one route, the way `SkillViewTabs` does it. A tab written as a
 * search parameter is read back with `useSearchParams()`, and on a statically prerendered
 * route that read never sees the write. `/plugins/[plugin]/[skill]` gets away with it because
 * it is server-rendered per request; `/knowledge` is static, so the same shape would render a
 * tab strip where clicking does nothing. `NavTabs` is `Link`-based, so each tab is ordinary
 * navigation and each view is linkable and back-button-correct.
 *
 * DELIBERATE: three tabs, not four. There is no Graph tab because the platform records no
 * node-to-node edge, so a graph would be drawn from shared tags and would assert
 * relationships nobody wrote down.
 */
const TABS = [
  { key: 'nodes', label: 'Nodes', href: '/knowledge', glyph: <BookOpen className="size-4" /> },
  { key: 'ask', label: 'Ask', href: '/knowledge/ask', glyph: <Sparkles className="size-4" /> },
  { key: 'log', label: 'Log', href: '/knowledge/log', glyph: <History className="size-4" /> },
] as const;

export function KnowledgeTabs({ active }: { active: KnowledgeView }) {
  return <NavTabs tabs={TABS} active={active} label="Knowledge views" />;
}
