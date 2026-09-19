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
 * RENDERING THIS IS NOT ENFORCEMENT. Every console read is scoped by the
 * gateway itself, per FR-3 — a caller who is not a superadmin gets
 * team-scoped data back no matter what parameter a request carries. This
 * control only decides which parameter `useConsole` attaches; hiding it from
 * everyone else is a courtesy that matches their actual authority, not the
 * thing standing between them and platform data. If it failed to render for
 * any reason, the person behind it would simply keep seeing their own team —
 * the safe direction to fail in, not a hole.
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
