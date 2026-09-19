'use client';

import { SidebarStat } from '@/components/Sidebar';
import { Eyebrow } from '@/components/ui';
import { useConsole, useConsoleMode } from '@/lib/api';
import { type Me, type Overview } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

/**
 * The rail's status block: who is signed in, and the one number worth carrying
 * on every page.
 *
 * The failure count is here rather than only on Overview because it is the
 * thing somebody would want to notice while reading something else — a person
 * three pages deep in the knowledge base should still be able to see that the
 * platform is refusing calls. It is a PLATFORM number, though: `/overview` is a
 * teamless route and its counts are the whole fleet's, so in team mode this
 * block names the one team being acted as and shows no counts at all. Carrying
 * "Teams 3 · Failing calls 2,982" into a member's rail told them about a
 * platform they cannot see and cannot act on.
 *
 * READ-ONLY, ALL OF IT. The platform/team switch used to sit here and the theme
 * toggle underneath it, which made the bottom of the rail a small control panel
 * wedged under a status block — two things you change, filed under a heading
 * that says what is true. Both are settings, so both are in Settings; what is
 * left here is who you are, one number worth carrying between pages, and the
 * way out.
 */
export function SidebarFooter() {
  const me = useConsole<Me>('/me');
  const { mode } = useConsoleMode();
  const platform = mode === 'platform';
  const overview = useConsole<Overview>(me.data?.mayRead && platform ? '/overview' : null);
  const c = overview.data?.counts;

  // Nothing at all until we know who they are. A rail that says "Signed in —
  // You: —" and offers a Sign out link to an anonymous visitor is three small
  // lies stacked on the one screen whose job is to be trusted.
  if (!me.data?.mayRead) return null;

  return (
    <dl className="flex flex-col gap-1.5 px-2.5">
      <Eyebrow className="!text-[0.625rem] text-ink-faint">Signed in</Eyebrow>
      <SidebarStat label="You" value={me.data.email.split('@')[0]} />
      {platform ? (
        <>
          <SidebarStat label="Teams" value={c ? String(c.teams) : '—'} />
          {/* ALL TIME, and it says so. This rail reads `/overview` with no period, so the
              number spans the whole history while the Overview tile beside it counts the
              selected window — the same word over two populations, with nothing on screen
              telling them apart. */}
          <SidebarStat
            label="Failing calls, all time"
            value={c ? formatCount(c.failures) : '—'}
            tone={c && c.failures > 0 ? 'attention' : undefined}
          />
        </>
      ) : (
        <SidebarStat label="Team" value={me.data.activeTeam ?? 'none'} />
      )}
      {/* A FORM, NOT A LINK. Signing out revokes a session row, and anything that can make
          this browser issue a GET — an image in a document body, a link in a mail — could
          issue that one. Nothing can make it POST cross-origin without the person acting. */}
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
