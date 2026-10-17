'use client';

import { memo } from 'react';

import { FormSection, SettingRow } from '@/components/patterns/form-section';
import { Segmented } from '@/components/ui/segmented';
import { useAccess } from '@/console/settings/access-read';
import { useConsole, useConsoleMode } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The superadmin's platform or team switch, on Access for the superadmin alone (reconciliation 53) until Phase 7 removes
 * the old addresses. Whether the caller is a superadmin is the console's server's answer, handed to the page with its
 * read, so the section is in the first paint for them and nowhere for anybody else: it never appears or goes at
 * hydration.
 *
 * Rendering is not enforcement: the gateway scopes every read whatever parameter the browser sends; this decides only
 * which parameter goes out, and which destinations `shownIn` gives the rail. The rail's workspace menu offers the same
 * choice.
 */
export function ConsoleScopePanel() {
  const { superadmin } = useAccess();
  const me = useConsole<Me>('/me');
  if (!superadmin) return null;
  return (
    <FormSection
      title="Console scope"
      description="What the rail and every page show you. Only a superadmin has the choice."
      footnote="Applies at once, in this browser. The rail's workspace menu offers the same choice."
    >
      <SettingRow label="Show" description={<ScopeProse />}>
        <ModeSwitch me={me.data} />
      </SettingRow>
    </FormSection>
  );
}

/** What the two scopes show, in the same words at every moment: memoised, so the row re-rendering when the switch
 *  arrives never re-paints the sentence. */
const ScopeProse = memo(function ScopeProse() {
  return (
    <>
      <strong className="font-medium text-ink-2">Platform</strong>: every team&rsquo;s work, plus the teams,
      plugins, runs and activity only you can act on.{' '}
      <strong className="font-medium text-ink-2">Team</strong>: what an ordinary member of your active
      team sees, and nothing else in the rail.
    </>
  );
});

/** Platform or team: the switch for a superadmin, and the space it takes for anyone else and while `/me` is still in
 *  flight, so the row's height never depends on what the read says. The placeholder is `aria-hidden`: it is a gap, not
 *  a control. */
export function ModeSwitch({ me }: { me: Me | undefined }) {
  const { mode, setMode } = useConsoleMode();
  if (!me?.superadmin) return <span aria-hidden className="block h-(--control-md) w-44" />;
  return <Segmented label="Console scope" value={mode} onChange={setMode} options={[{ value: 'platform', label: 'Platform' }, { value: 'team', label: 'Team' }]} />;
}
