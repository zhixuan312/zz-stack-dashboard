'use client';

import { SidebarStat } from '@/components/Sidebar';
import { Eyebrow } from '@/components/ui';
import { useConsole, useConsoleMode } from '@/lib/api';
import { type Me, type Overview } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

/**
 * The rail's status block: who is signed in, and the one number worth carrying on every page.
 *
 * The failure count is here rather than only on Overview because it is the thing somebody would
 * want to notice while reading something else. It is a platform number, though: `/overview` is a
 * teamless route and its counts are the whole fleet's, so in team mode this block names the one
 * team being acted as and shows no counts at all — carrying a platform figure into a member's rail
 * tells them about a platform they cannot see and cannot act on.
 *
 * Read-only, all of it. The platform/team switch and the theme toggle are settings and live in
 * Settings; what is left here is who you are, one number worth carrying between pages, and the way
 * out.
 */
export function SidebarFooter() {
  const me = useConsole<Me>('/me');
  const { mode } = useConsoleMode();
  const platform = mode === 'platform';
  const overview = useConsole<Overview>(me.data?.mayRead && platform ? '/overview' : null);
  const c = overview.data?.counts;

  // Nothing at all until we know who they are. A rail that says "Signed in — You: —" and offers a
  // Sign out link to an anonymous visitor is three small lies on the one screen whose job is to be
  // trusted.
  if (!me.data?.mayRead) return null;

  return (
    <dl className="flex flex-col gap-1.5 px-2.5">
      <Eyebrow className="!text-[0.625rem] text-ink-faint">Signed in</Eyebrow>
      <SidebarStat label="You" value={me.data.email.split('@')[0]} />
      {platform ? (
        <>
          <SidebarStat label="Teams" value={c ? String(c.teams) : '—'} />
          {/* All time, and it says so. This rail reads `/overview` with no period, so the
              number spans the whole history while the Overview tile beside it counts the
              selected window. */}
          <SidebarStat
            label="Failing calls, all time"
            value={c ? formatCount(c.failures) : '—'}
            tone={c && c.failures > 0 ? 'attention' : undefined}
          />
        </>
      ) : (
        <SidebarStat label="Team" value={me.data.activeTeam ?? 'none'} />
      )}
      {/* A form, not a link. Signing out revokes a session row, and anything that can make this
          browser issue a GET — an image in a document body, a link in a mail — could issue that
          one. Nothing can make it POST cross-origin without the person acting. */}
      <form method="post" action="/auth/logout" className="pt-1">
        <button
          type="submit"
          className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </form>
    </dl>
  );
}
