'use client';

import { Segmented } from '@/components/ui/segmented';
import { Panel } from '@/console/panel';
import { useConsole, useConsoleMode } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The superadmin's platform/team switch.
 *
 * DELIBERATE: it is not inside `PlatformSection`. It gates on `me.superadmin` in its own
 * right and sits above the platform tier, because team mode hides that tier. Nesting the
 * switch inside anything team mode hides is a one-way door: flip to Team, lose the control,
 * no way back short of clearing localStorage.
 *
 * Rendering is not enforcement: the gateway scopes every read whatever parameter the browser
 * sends; this decides only which parameter goes out, and which rail `navGroups` draws. The
 * rail's workspace menu offers the same choice.
 */
export function ConsoleScopePanel() {
  const me = useConsole<Me>('/me');
  if (!me.data?.superadmin) return null;

  return (
    <Panel title="Console scope" description="superadmin">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-3">
          <strong className="font-medium text-ink-2">Platform</strong> shows the whole
          fleet — every team&rsquo;s work, plus the teams, plugins, runs and activity that
          only you can act on.{' '}
          <strong className="font-medium text-ink-2">Team</strong> is what an ordinary
          member of {me.data.activeTeam ?? 'your active team'} sees: their team, its
          initiatives, its knowledge and its people, and nothing else in the rail.
        </p>
        <ModeSwitch me={me.data} />
      </div>
    </Panel>
  );
}

/** Platform or team, for a superadmin only: a member has one scope and nothing to switch. */
export function ModeSwitch({ me }: { me: Me }) {
  const { mode, setMode } = useConsoleMode();
  if (!me.superadmin) return null;
  return <Segmented label="Console scope" value={mode} onChange={setMode} options={[{ value: 'platform', label: 'Platform' }, { value: 'team', label: 'Team' }]} />;
}
