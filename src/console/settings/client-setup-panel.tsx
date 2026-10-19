'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { FormSection } from '@/components/patterns/form-section';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ReadingBody } from '@/console/reading';
import { useAccess } from '@/console/settings/access-read';

/** One part of the setup: steps to read, or a block of commands to run, numbered from 1. */
type Part = { kind: 'steps'; text: string } | { kind: 'commands'; text: string; n: number };

/**
 * A step's heading two levels down, so the reading body draws `## 1. Install` at a body's size under the section's
 * own title (`t-card`) rather than larger than it: written for a chat, the setup's headings are a page's, and here they
 * sit inside one section of Access. Six is as deep as Markdown goes.
 */
const underTheSection = (text: string): string => text.replace(/^(#{1,6}) /gm, (_, marks: string) => `${'#'.repeat(Math.min(6, marks.length + 2))} `);

/**
 * The setup as the person reads it. The gateway writes it as Markdown for an agent's chat (`renderClientSetup`), so
 * its steps are rendered here rather than printed with their marks, and each fenced block of commands is a block of
 * its own with its own Copy: the commands are what a person takes to a terminal. Its first heading names who it is for,
 * which the section's own title already says, so it is not drawn twice; the rest step down under that title.
 */
function partsOf(config: string): Part[] {
  const parts: Part[] = [];
  const body = config.replace(/^# [^\n]*\n+/, '');
  let at = 0;
  for (const m of body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    const before = body.slice(at, m.index).trim();
    if (before) parts.push({ kind: 'steps', text: underTheSection(before) });
    parts.push({ kind: 'commands', text: m[1].replace(/\n$/, ''), n: parts.filter((p) => p.kind === 'commands').length + 1 });
    at = m.index + m[0].length;
  }
  const after = body.slice(at).trim();
  if (after) parts.push({ kind: 'steps', text: underTheSection(after) });
  return parts;
}

/** The text's own Copy: a check for two seconds once the clipboard took it, and a toast when it did not. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy: select the commands and copy them by hand.' });
    }
  }
  return (
    <Button type="button" size="sm" variant="secondary" aria-label={label} icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/**
 * The caller's own Claude Code setup, from the Access read: the browser counterpart of `client_setup` on the /manage
 * door. `config` always carries a placeholder bearer (`<YOUR-TOKEN>`, `$ZZ_TOKEN`), never a live one (`renderClientSetup`
 * in the gateway's admin/flows.ts), so there is no credential in it to guard.
 */
export function ClientSetupPanel() {
  const { access } = useAccess();
  const parts = partsOf(access.setup.config);
  const blocks = parts.filter((p) => p.kind === 'commands').length;
  return (
    <FormSection
      as="div"
      title="Client setup"
      description="What to run in Claude Code to connect it to this platform as you. Put a token where it says to."
    >
      <div data-setup className="flex flex-col gap-3">
        {parts.map((p, i) => {
          if (p.kind === 'steps') return <ReadingBody key={i}>{p.text}</ReadingBody>;
          return (
            // The Copy heads its block rather than standing over it, so the commands have the block's whole width.
            <div key={i} className="rounded-md bg-surface-sunk">
              <div className="flex justify-end px-2.5 pt-2.5">
                <CopyButton text={p.text} label={blocks > 1 ? `Copy the commands of block ${p.n}` : 'Copy the commands'} />
              </div>
              <pre className="px-4 pt-1 pb-4 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{p.text}</pre>
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}
