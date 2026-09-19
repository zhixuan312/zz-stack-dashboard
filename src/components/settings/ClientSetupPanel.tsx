'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Button, Segmented } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsole } from '@/lib/api';
import { type MyClientSetup } from '@/lib/api-shapes';

/** Mirrors the gateway's own `CLIENT_KINDS` (client-package.ts) — the three
 *  clients this platform renders a config for. */
const CLIENTS = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'hermes', label: 'Hermes' },
];

/**
 * Your own MCP config for the client of your choice — the browser
 * counterpart of `my_client_setup` (server.ts). `config` always carries a
 * PLACEHOLDER bearer (`<YOUR-TOKEN>` / `$ZZ_TOKEN`), never a live one — see
 * `renderClientSetup` (gateway admin.ts) — so there is nothing here for this
 * page to guard the way it guards a credential or a token.
 */
export function ClientSetupPanel() {
  const [client, setClient] = useState('claude-code');
  const [copied, setCopied] = useState(false);
  const setup = useConsole<MyClientSetup>(`/settings/me/client-setup?client=${encodeURIComponent(client)}`);

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
        <Segmented label="Client" value={client} onChange={setClient} options={CLIENTS} />
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
