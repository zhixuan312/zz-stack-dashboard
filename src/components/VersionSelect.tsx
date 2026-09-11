'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui';

export const ALL_VERSIONS = 'all';

/**
 * Which version of the skill produced the scores being read.
 *
 * THE URL IS THE STATE, the same way the period picker works — a version-scoped
 * view is then linkable and survives a refresh, which matters here more than it
 * does for a period: "1.0 scored 3.42 on these thirty documents" is a claim
 * somebody sends to somebody else.
 *
 * Renders nothing only when NO version is known. With one, "All versions" and that
 * version still give different answers — the version's own documents against every
 * document of that type, including those written before the platform recorded which
 * version produced them — so the control changes what is shown and belongs on the
 * page.
 */
export function VersionSelect({ versions }: { versions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('version') ?? ALL_VERSIONS;

  if (versions.length === 0) return null;

  function onChange(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next === ALL_VERSIONS) q.delete('version');
    else q.set('version', next);
    const query = q.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]" aria-label="Skill version">
        {current === ALL_VERSIONS ? 'All versions' : `Version ${current}`}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VERSIONS}>All versions</SelectItem>
        {versions.map((v) => (
          <SelectItem key={v} value={v}>Version {v}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
