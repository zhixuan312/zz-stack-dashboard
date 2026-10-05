'use client';

import { FormSection, SettingRow } from '@/components/patterns/form-section';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
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
  const data = me.data;
  // The shape it will have, drawn while `/me` is in flight. Returning `null` and then appearing
  // made this section — about 374px of prose and a control, measured — push every section below
  // it down: /settings measured CLS 0.286 on Linux, and 0.000 where the read wins the race to
  // first paint, which is why only CI saw it. A placeholder of the same shape shifts nothing
  // whichever way the read goes, where leaving the space out shifts it every time.
  if (!data) {
    return (
      <FormSection
        title="Console scope"
        description="What the rail and every page show you. Only a superadmin has the choice."
        footnote="Applies at once, in this browser. The rail's workspace menu offers the same switch."
      >
        <SettingRow label="Show" description={<Skeleton className="block h-16 w-full max-w-[60ch]" />}>
          <Skeleton className="h-8 w-44 rounded-md" />
        </SettingRow>
      </FormSection>
    );
  }
  if (!data.superadmin) return null;

  return (
    <FormSection
      title="Console scope"
      description="What the rail and every page show you. Only a superadmin has the choice."
      footnote="Applies at once, in this browser. The rail's workspace menu offers the same switch."
    >
      <SettingRow
        label="Show"
        description={
          <>
            <strong className="font-medium text-ink-2">Platform</strong>: every team&rsquo;s work, plus the teams,
            plugins, runs and activity only you can act on.{' '}
            <strong className="font-medium text-ink-2">Team</strong>: what an ordinary member of{' '}
            {me.data.activeTeam ?? 'your active team'} sees, and nothing else in the rail.
          </>
        }
      >
        <ModeSwitch me={me.data} />
      </SettingRow>
    </FormSection>
  );
}

/** Platform or team, for a superadmin only: a member has one scope and nothing to switch. */
export function ModeSwitch({ me }: { me: Me }) {
  const { mode, setMode } = useConsoleMode();
  if (!me.superadmin) return null;
  return <Segmented label="Console scope" value={mode} onChange={setMode} options={[{ value: 'platform', label: 'Platform' }, { value: 'team', label: 'Team' }]} />;
}
