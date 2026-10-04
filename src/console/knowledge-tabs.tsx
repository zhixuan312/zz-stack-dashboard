import { LinkTabs } from '@/console/link-tabs';

/**
 * The knowledge base's three views, as routes. No Graph view: the platform records no edge between nodes, so a graph
 * would be drawn from shared tags and assert relationships nobody wrote down.
 */
const TABS = [
  { key: 'nodes', label: 'Nodes', href: '/knowledge' },
  { key: 'ask', label: 'Ask', href: '/knowledge/ask' },
  { key: 'log', label: 'Log', href: '/knowledge/log' },
] as const;

export function KnowledgeTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return <LinkTabs tabs={TABS} active={active} label="Knowledge views" />;
}
