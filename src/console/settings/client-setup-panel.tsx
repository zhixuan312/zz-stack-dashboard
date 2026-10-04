'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CardBody } from '@/components/ui/card';
import { SettingsCard, SettingsSection } from '@/console/settings/section';
import { Query } from '@/console/query';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useConsole } from '@/lib/api';
import { type MyClientSetup } from '@/lib/api-shapes';

/**
 * Your own Claude Code setup — the browser counterpart of `client_setup` (access-door.ts).
 * `config` always carries a placeholder bearer (`<YOUR-TOKEN>` / `$ZZ_TOKEN`), never a live one
 * (see `renderClientSetup` in the gateway's admin/flows.ts), so there is no credential on this
 * page to guard.
 */
export function ClientSetupPanel() {
  const [copied, setCopied] = useState(false);
  const setup = useConsole<MyClientSetup>('/settings/me/client-setup');

  async function copy(config: string) {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy — select and copy the config by hand.' });
    }
  }

  return (
    <SettingsSection
      title="Client setup"
      description="What to run in Claude Code to connect it to this platform as you. Put an access token where it says to."
    >
      <SettingsCard>
        <CardBody>
          <Query query={setup} skeletonRows={4}>
            {(s) => (
              <div className="relative">
                <pre className="whitespace-pre-wrap rounded-md bg-surface-sunk p-4 pr-24 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {s.config}
                </pre>
                <Button type="button" size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />}
                        onClick={() => void copy(s.config)} className="absolute top-2.5 right-2.5">
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </Query>
        </CardBody>
      </SettingsCard>
    </SettingsSection>
  );
}
