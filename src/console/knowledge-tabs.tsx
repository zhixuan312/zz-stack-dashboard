import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LinkTabs } from '@/components/ui/tabs';

/**
 * Knowledge's two views, as routes: the page itself, and its log, which `/knowledge/log` draws until Phase 7 removes
 * the address. No Graph view: the platform records no edge between nodes, so a graph would be drawn from shared tags and
 * assert relationships nobody wrote down.
 */
const TABS = [
  { key: 'knowledge', label: 'Overview', href: '/knowledge' },
  { key: 'log', label: 'Log', href: '/knowledge/log' },
] as const;

export function KnowledgeTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return <LinkTabs tabs={TABS} active={active} label="Knowledge views" />;
}

/**
 * A Knowledge page's first read, kept live: the console's server made it with the person's own cookie and handed it to
 * the page, so no browser query holds it for the live stream to read again. This is one that stands for it, under the
 * read's own path, so a hint that `knowledge` changed reaches it as it reaches every browser read of that collection
 * (`ConsoleLive`), and reading it again is asking the server for the page again. Its data is no figure, and it is never
 * stale on its own: it reads only when a hint says so.
 */
export function useServerReadLive(path: string): void {
  const router = useRouter();
  useQuery({
    queryKey: ['console', path, 'server-read'],
    queryFn: () => { router.refresh(); return Date.now(); },
    initialData: 0,
    initialDataUpdatedAt: 0,
    staleTime: Infinity,
    retry: false,
  });
}
