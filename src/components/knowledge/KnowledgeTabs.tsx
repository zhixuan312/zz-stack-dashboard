import { BookOpen, History, Sparkles } from 'lucide-react';
import { NavTabs } from '@/components/ui/nav-tabs';

type KnowledgeView = 'nodes' | 'ask' | 'log';

/**
 * The knowledge base's three views, as REAL ROUTES.
 *
 * Not `?view=` on one route, which is how `SkillViewTabs` does it and is the trap this
 * console has already fallen into twice: a tab written as a search parameter is read back
 * with `useSearchParams()`, and on a statically prerendered route that read never sees the
 * write. It works for a skill only because `/flows/[flow]/[skill]` is server-rendered per
 * request; `/knowledge` is static, so the same shape would render a tab strip where
 * clicking does nothing — exactly what the period picker did before it moved into context.
 *
 * `NavTabs` is `Link`-based, so each tab is ordinary navigation. That also makes each view
 * linkable and back-button-correct for free, which is what the search parameter was
 * supposed to buy and did not.
 *
 * THREE, NOT FOUR. The journal in multi-model-agent-forge — the shape this follows — has a Graph tab beside these
 * and it is deliberately not here: the platform records no node-to-node edge, so a graph
 * would be drawn from shared tags and would assert relationships nobody wrote down.
 */
const TABS = [
  { key: 'nodes', label: 'Nodes', href: '/knowledge', glyph: <BookOpen className="size-4" /> },
  { key: 'ask', label: 'Ask', href: '/knowledge/ask', glyph: <Sparkles className="size-4" /> },
  { key: 'log', label: 'Log', href: '/knowledge/log', glyph: <History className="size-4" /> },
] as const;

export function KnowledgeTabs({ active }: { active: KnowledgeView }) {
  return <NavTabs tabs={TABS} active={active} label="Knowledge views" />;
}
