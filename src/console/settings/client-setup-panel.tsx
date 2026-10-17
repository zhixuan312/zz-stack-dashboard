'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { FormSection } from '@/components/patterns/form-section';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAccess } from '@/console/settings/access-read';

/**
 * The caller's own Claude Code setup, from the Access read: the browser counterpart of `client_setup` on the /manage
 * door. `config` always carries a placeholder bearer (`<YOUR-TOKEN>`, `$ZZ_TOKEN`), never a live one (`renderClientSetup`
 * in the gateway's admin/flows.ts), so there is no credential in it to guard.
 */
export function ClientSetupPanel() {
  const { access } = useAccess();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(access.setup.config);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy: select the commands and copy them by hand.' });
    }
  }

  return (
    <FormSection
      as="div"
      title="Client setup"
      description="What to run in Claude Code to connect it to this platform as you. Put a token where it says to."
    >
      <div className="relative">
        <pre data-setup className="whitespace-pre-wrap rounded-md bg-surface-sunk p-4 pr-24 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
          {access.setup.config}
        </pre>
        <Button type="button" size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()} className="absolute top-2.5 right-2.5">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </FormSection>
  );
}
