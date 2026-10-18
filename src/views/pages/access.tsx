'use client';

import { RotateCw } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { Busy } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { failureOf } from '@/console/query';
import { AccessProvider } from '@/console/settings/access-read';
import { ApplicationsPanel } from '@/console/settings/applications-panel';
import { AssistantPanel } from '@/console/settings/assistant-panel';
import { BrowsersPanel } from '@/console/settings/browsers-panel';
import { ClientSetupPanel } from '@/console/settings/client-setup-panel';
import { PasskeysPanel } from '@/console/settings/passkeys-panel';
import { TeamAdminPanel } from '@/console/settings/team-admin-panel';
import { TeamSection } from '@/console/settings/teams-panel';
import { TokensPanel } from '@/console/settings/tokens-panel';
import { useDataClock } from '@/lib/api';
import type { Access } from '@/lib/destination-shapes';
import { useLive } from '@/lib/live';
import { accessContext, accessTrouble, asOfLine, type AccessRead } from '@/views/access-context';
import { pendingContext } from '@/views/context';
import { useServed } from '@/views/use-served';

type Trouble = Exclude<AccessRead, { state: 'ok' }>;

/**
 * The page's read: the one the console's server made, so the first paint carries every section and the browser asks for
 * nothing more, then the browser's own once a write, a change in another tab or a Retry says it is stale. A failure is
 * stated only when there is nothing to draw: the browser's, or the server's while the browser has not read.
 */
function useAccessRead(served: AccessRead) {
  const { q, follow } = useServed<Access>('/access', true);
  const access = q.data ?? (served.state === 'ok' ? served.access : undefined);
  const failed = failureOf(q);
  const trouble: Trouble | null = access ? null : failed ? { state: 'failed', reason: failed } : served.state !== 'ok' && !q.isFetching ? served : null;
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { access, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : access ? access.meta.asOf : null };
}

/**
 * What lets the caller in, and nothing of anybody else's, read on the console's server and handed here whole: their
 * tokens, the setup to connect a client, the applications and browsers signed in as them, their passkeys and the team
 * they act for; the members of that team for its admin, and the assistant's switch where the console has one. Every change is the person's, on this page, through the gateway's own routes: the
 * assistant reads the page and changes nothing.
 *
 * Its own changes and any other tab's (the gateway tells every tab `settings`) read it again in the browser.
 */
export function AccessView({ served }: { served: AccessRead }) {
  useLive(['settings']);
  const now = useDataClock();
  const { access, trouble, retry, updatedAt } = useAccessRead(served);
  useShareView(access
    ? accessContext(access, { updatedAt, now })
    : pendingContext({ view: 'access', title: 'Access', address: '/access', scope: 'the caller\'s own access' }, trouble ? accessTrouble(trouble).detail : null));
  if (!access) return trouble ? <AccessTrouble trouble={trouble} onRetry={retry} /> : <Busy name="access"><AccessSkeleton /></Busy>;
  return (
    <AccessProvider value={{ access }}>
      {/* Sections 56px apart, as Meridian's settings stack them: what lets you in, then your team, then this console. */}
      <div className="flex flex-col gap-14">
        <TokensPanel />
        <ClientSetupPanel />
        <ApplicationsPanel />
        <BrowsersPanel />
        <PasskeysPanel />
        <TeamSection />
        <TeamAdminPanel />
        <AssistantPanel />
      </div>
    </AccessProvider>
  );
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function AccessAsOf({ read }: { read: AccessRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.access)}</span>;
}

/**
 * One placeholder section per section the page can stack, for the tallest page: a person who administers the team
 * they act for, on a console with an assistant. A frame shorter than the page grows when the page arrives, which is
 * what it exists to prevent; anybody else's page is shorter, and nothing below its last section moves.
 * COUPLED: `app/(dash)/access/loading.tsx`, the same frame before the gate has answered.
 */
const SECTIONS = 8;

export function AccessSkeleton() {
  return (
    <div className="flex flex-col gap-14">
      {Array.from({ length: SECTIONS }, (_, i) => (
        <div key={i} className="@container">
          <div className="grid gap-x-10 gap-y-5 @3xl:grid-cols-[15rem_minmax(0,var(--field-width))]">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AccessTrouble({ trouble, onRetry }: { trouble: Trouble; onRetry: () => void }) {
  const { title, detail } = accessTrouble(trouble);
  return (
    <Card>
      <EmptyState kind="error" title={title} className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={onRetry}>Retry</Button>}>
        {detail}
      </EmptyState>
    </Card>
  );
}
