import { LinkTabs } from '@/components/ui/tabs';

/**
 * The knowledge base's two views, as routes. No Graph view: the platform records no edge between nodes, so a graph
 * would be drawn from shared tags and assert relationships nobody wrote down.
 */
const TABS = [
  { key: 'nodes', label: 'Nodes', href: '/knowledge' },
  { key: 'log', label: 'Log', href: '/knowledge/log' },
] as const;

export function KnowledgeTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return <LinkTabs tabs={TABS} active={active} label="Knowledge views" />;
}
