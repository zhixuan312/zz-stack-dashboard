'use client';

import { Panel } from '@/components/Panel';
import { ThemeToggle } from '@/components/ui';

/**
 * Light / System / Dark, in Settings.
 *
 * It used to sit at the very bottom of the rail, under the signed-in block —
 * three unlabelled icon buttons wedged beneath a list of facts, with nothing
 * saying what they were. A person who has never clicked them cannot tell a
 * theme switch from a view switch from a density control by looking at a sun,
 * a monitor and a moon; here the panel names it, and it sits with the other
 * things you change rather than under the things you read.
 *
 * NO GATE. Everyone who reaches the console picks their own theme — this is the
 * one panel on the page that needs neither a role nor a team.
 */
export function AppearancePanel() {
  return (
    <Panel title="Appearance" aside="stored in this browser">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-faint">
          System follows your operating system&rsquo;s own light/dark setting and is the
          default. The choice is remembered in this browser only — it does not travel with
          your account.
        </p>
        <ThemeToggle />
      </div>
    </Panel>
  );
}
