import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';

/**
 * Settings, until Phase 7 removes its address (AC-1.12): one sentence saying where its contents went, with the link, and
 * nothing else. What it held is on Access (tokens, client setup, applications, browsers, passkeys, the team acted for,
 * its members for an admin, the console scope and the assistant's switch) and under Platform (People and Teams), as
 * reconciliation 53 places it. It reads nothing and shares nothing with the assistant: there is nothing here to ask about.
 */
export function SettingsView() {
  return (
    <PageFrame kicker={<>{app.name} · {workspaces.main.label}</>} title="Settings" width="reading">
      <p data-moved className="t-body text-ink-2">
        Everything that was here is on <Link href="/access" className="hit rounded-xs font-medium text-accent-ink underline underline-offset-4 hover:text-ink">Access</Link> now: your tokens, client setup, applications, browsers, passkeys and the team you act for.
      </p>
    </PageFrame>
  );
}
