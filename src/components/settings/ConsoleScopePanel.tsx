'use client';

import { ModeSwitch } from '@/components/ModeSwitch';
import { Panel } from '@/components/Panel';
import { useConsole, type Me } from '@/lib/api';

/**
 * The superadmin's platform/team switch (← moved out of `SidebarFooter`).
 *
 * WHY IT MOVED. In the rail it was a two-word segmented control with no label,
 * sitting between "You: sam" and a pair of counts — so it read as
 * another status line rather than the one control on the console that changes
 * what every page shows. It is a setting; it is in Settings.
 *
 * WHY IT IS NOT INSIDE `PlatformSection`. This gates on `me.superadmin` in its
 * own right and sits ABOVE the platform tier, because that tier is one of the
 * things team mode is meant to preview. Nesting the switch inside anything that
 * team mode hides would be a one-way door: flip to Team, lose the control, no
 * way back short of clearing localStorage.
 *
 * RENDERING IS NOT ENFORCEMENT — see `ModeSwitch` itself. The gateway scopes
 * every read per FR-3 whatever parameter the browser sends; this only decides
 * which parameter goes out, and which rail `navSections` draws.
 */
export function ConsoleScopePanel() {
  const me = useConsole<Me>('/me');
  if (!me.data?.superadmin) return null;

  return (
    <Panel title="Console scope" aside="superadmin">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-faint">
          <strong className="font-medium text-ink-soft">Platform</strong> shows the whole
          fleet — every team&rsquo;s work, plus the flows, blocks, runs and activity that
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
