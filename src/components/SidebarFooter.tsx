'use client';

import { SidebarStat } from '@/components/Sidebar';
import { Eyebrow } from '@/components/ui';
import { useConsole, useConsoleMode } from '@/lib/api';
import { type Me, type Overview } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';
import { LogOut } from 'lucide-react';

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

  const handle = me.data.email.split('@')[0];

  return (
    <div className="flex flex-col gap-3 px-1">
      {platform ? (
        // All time, and it says so. This rail reads `/overview` with no period, so the numbers
        // span the whole history while the Overview tiles count the selected window.
        // DELIBERATE: no amber on the failure count. It is an all-time total and never zero, so
        // a warning colour on it would be on permanently, and a colour that never changes
        // means nothing.
        <div className="flex flex-col gap-1 px-1.5">
          <Eyebrow className="pb-0.5">All time</Eyebrow>
          <dl className="flex flex-col gap-1">
            <SidebarStat label="Teams" value={c ? String(c.teams) : '—'} />
            <SidebarStat label="Failing calls" value={c ? formatCount(c.failures) : '—'} />
          </dl>
        </div>
      ) : null}

      {/* Who is signed in, as a person rather than a table row: the initial, the handle, and
          what they are acting as. */}
      <div className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-line bg-surface px-2 py-2">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-tint text-sm font-semibold uppercase text-accent-deep"
        >
          {handle.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight text-ink" title={me.data.email}>{me.data.name || handle}</p>
          <p className="truncate text-xs leading-snug text-ink-faint">
            {/* The role, not a team count: the platform's team total sits just above, and two
                different "teams" figures an inch apart is one question with two answers. */}
            {platform
              ? (me.data.superadmin ? 'Superadmin' : 'Member')
              : `Acting for ${me.data.activeTeam ?? 'no team'}`}
          </p>
        </div>
        {/* A form, not a link. Signing out revokes a session row, and anything that can make
            this browser issue a GET — an image in a document body, a link in a mail — could
            issue that one. Nothing can make it POST cross-origin without the person acting. */}
        <form method="post" action="/auth/logout">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="press focus-ring grid size-8 place-items-center rounded-[var(--r)] text-ink-faint hover:bg-bg-sunk hover:text-ink"
          >
            <LogOut className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
