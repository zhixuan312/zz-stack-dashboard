'use client';

import { memo } from 'react';

import { FormSection, SettingRow } from '@/components/patterns/form-section';
import { Segmented } from '@/components/ui/segmented';
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
 *
 * THE SECTION IS DRAWN FOR EVERYONE; ONLY THE SWITCH IS EARNED. An earlier version returned
 * `null` until `/me` said superadmin, so the page's largest text block was not in the HTML at all
 * and `/settings` — the console's slowest page — reached its largest contentful paint at 2.25s
 * where every page that ships its own words paints at 0.6s. The description is the same sentence
 * for a member and for a superadmin, and it says which of them has the choice, so a member reads
 * why they have no switch rather than nothing. Nothing here is disclosed by that: `/me` already
 * answers who is calling, and the gateway refuses a scoped read to anyone who may not make it.
 *
 * DELIBERATE: and the row's height never depends on what the read says. A member's slot holds
 * the space the switch would take and nothing in it, so neither identity sees anything move when
 * `/me` lands — the shift this section caused went one way for a superadmin (the row appearing)
 * and the other for a member (the placeholder going), and a fixed slot ends both.
 */
export function ConsoleScopePanel() {
  const me = useConsole<Me>('/me');
  return (
    <FormSection
      title="Console scope"
      description="What the rail and every page show you. Only a superadmin has the choice."
      footnote="Applies at once, in this browser. A superadmin chooses between them in the rail's workspace menu."
    >
      <SettingRow label="Show" description={<ScopeProse />}>
        <ModeSwitch me={me.data} />
      </SettingRow>
    </FormSection>
  );
}

/** What the two scopes show, in the same words for everyone and at every moment.
 *
 *  COUPLED: no team name, and not because the prose reads better without one. This is the page's
 *  largest text block, so a sentence that changes when `/me` lands re-paints it — and the paint
 *  that arrives after hydration is the one the LCP takes. The active team is named by the rail
 *  and by the workspace menu; the sentence does not need it to say what the two scopes mean.
 *
 *  COUPLED: and it is memoised, because the row around it re-renders when the switch arrives.
 *  Re-rendering a component React has already committed re-creates its text node, and a re-painted
 *  largest block is a new LCP candidate: measured 1424ms against 656ms on pages whose largest
 *  block is never re-rendered, for a sentence the reader could see from first paint either way. */
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

/** Platform or team: the switch for a superadmin, the space it takes for everyone else, and the
 *  space alone while `/me` is still in flight. A member has one scope and nothing to switch, and
 *  the placeholder is `aria-hidden` — it is a gap, not a control. */
export function ModeSwitch({ me }: { me: Me | undefined }) {
  const { mode, setMode } = useConsoleMode();
  if (!me?.superadmin) return <span aria-hidden className="block h-(--control-md) w-44" />;
  return <Segmented label="Console scope" value={mode} onChange={setMode} options={[{ value: 'platform', label: 'Platform' }, { value: 'team', label: 'Team' }]} />;
}
