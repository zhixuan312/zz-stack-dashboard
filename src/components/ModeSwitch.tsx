'use client';

import { Segmented } from '@/components/ui/segmented';
import { useConsoleMode } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

const OPTIONS: { value: 'platform' | 'team'; label: string }[] = [
  { value: 'platform', label: 'Platform' },
  { value: 'team', label: 'Team' },
];

/**
 * The superadmin's platform/team switch — rendered only for `me.superadmin`.
 *
 * DELIBERATE: rendering this is not enforcement. Every console read is scoped
 * by the gateway itself — a caller who is not a superadmin gets team-scoped
 * data back whatever parameter a request carries. This control only decides
 * which parameter `useConsole` attaches, so failing to render it leaves the
 * person seeing their own team.
 */
export function ModeSwitch({ me }: { me: Me }) {
  const { mode, setMode } = useConsoleMode();
  if (!me.superadmin) return null;
  return (
    <Segmented
      value={mode}
      onChange={(v) => setMode(v as 'platform' | 'team')}
      options={OPTIONS}
      label="Console scope"
    />
  );
}
