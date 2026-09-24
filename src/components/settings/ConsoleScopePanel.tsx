'use client';

import { ModeSwitch } from '@/components/ModeSwitch';
import { Panel } from '@/components/Panel';
import { useConsole } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The superadmin's platform/team switch.
 *
 * DELIBERATE: it is not inside `PlatformSection`. It gates on `me.superadmin` in its own
 * right and sits above the platform tier, because team mode hides that tier. Nesting the
 * switch inside anything team mode hides is a one-way door: flip to Team, lose the control,
 * no way back short of clearing localStorage.
 *
 * Rendering is not enforcement — see `ModeSwitch`. The gateway scopes every read
 * whatever parameter the browser sends; this decides only which parameter goes out, and
 * which rail `navSections` draws.
 */
export function ConsoleScopePanel() {
  const me = useConsole<Me>('/me');
  if (!me.data?.superadmin) return null;

  return (
    <Panel title="Console scope" aside="superadmin">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-faint">
          <strong className="font-medium text-ink-soft">Platform</strong> shows the whole
          fleet — every team&rsquo;s work, plus the teams, plugins, runs and activity that
          only you can act on.{' '}
          <strong className="font-medium text-ink-soft">Team</strong> is what an ordinary
          member of {me.data.activeTeam ?? 'your active team'} sees: their team, its
          initiatives, its knowledge and its people, and nothing else in the rail.
        </p>
        <ModeSwitch me={me.data} />
      </div>
    </Panel>
  );
}
