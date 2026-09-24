'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Button } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
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
      showToast({ type: 'error', message: 'Could not copy — select and copy the config by hand.' });
    }
  }

  return (
    <Panel
      title="Client setup"
      aside={
        <Button type="button" size="sm" variant="ghost" leftIcon={copied ? <Check /> : <Copy />}
                onClick={() => setup.data && void copy(setup.data.config)} disabled={!setup.data}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Query query={setup} skeletonRows={4}>
          {(s) => (
            <pre className="whitespace-pre-wrap break-all rounded-[var(--r)] bg-surface-2 p-3 font-mono text-[11px] leading-relaxed">
              {s.config}
            </pre>
          )}
        </Query>
        <p className="text-xs text-ink-faint">
          Pair this with an access token below — the placeholder in the config needs a real one to connect.
        </p>
      </div>
    </Panel>
  );
}
