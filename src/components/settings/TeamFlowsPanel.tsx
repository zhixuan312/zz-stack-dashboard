'use client';

import { useState } from 'react';
import { Workflow } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  EmptyState, Field, FieldGrid, Input, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  usePaged,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole, type TeamFlowRow } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * A team admin's installed flows for ONE team — install and uninstall. The browser
 * counterpart of `install_flow` / `uninstall_flow` (admin.ts), the same relationship
 * `TeamMembersPanel` has to `add_member` / `remove_member`.
 *
 * No flow picker: this console has no endpoint that lists the catalog (that is
 * `list_catalog`, on `/manage/mcp`, reached by an agent, not this page), so Flow is a
 * plain text field the same way Platform is on `CredentialsPanel` — the gateway is
 * what actually knows whether the name resolves, and says so in the refusal if not.
 */
export function TeamFlowsPanel({ team }: { team: string }) {
  const list = useConsole<TeamFlowRow[]>(`/settings/team/flows?team=${encodeURIComponent(team)}`);
  const [flow, setFlow] = useState('');
  const [version, setVersion] = useState('');
  const [agentName, setAgentName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const installMutation = useConsoleMutation<
    { ok: true; result: string },
    { flow: string; version?: string; agent_name?: string }
  >((v) => ({
    path: '/settings/team/flows', method: 'POST',
    body: { team, flow: v.flow, version: v.version || undefined, agent_name: v.agent_name || undefined },
  }));
  const uninstallMutation = useConsoleMutation<{ ok: true; result: string }, string>(
    // Same inline-confirm shape as TeamMembersPanel's remove — `confirm` is the flow
    // name this panel already knows, sent by the second click, never retyped.
    (flowName) => ({ path: '/settings/team/flows', method: 'DELETE', body: { team, flow: flowName, confirm: flowName } }),
  );

  async function install() {
    setError(null);
    try {
      await installMutation.mutateAsync({ flow: flow.trim(), version: version.trim(), agent_name: agentName.trim() });
      setFlow('');
      setVersion('');
      setAgentName('');
      showToast({ type: 'success', message: `Installed ${flow.trim()} for ${team}.` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not install flow — try again.');
    }
  }

  async function uninstall(flowName: string) {
    try {
      await uninstallMutation.mutateAsync(flowName);
      showToast({ type: 'success', message: `Uninstalled ${flowName} from ${team}.` });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not uninstall flow — try again.' });
    }
  }

  return (
    <>
      <Panel title="Flows" aside={`${team} — install or remove`} padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-welcome.png', width: 78, height: 96 }}
                  icon={<Workflow className="size-5" strokeWidth={2} />}
                  title="No flow installed"
                  description="Install one below — this team has no agent yet."
                />
              </div>
            ) : (
              <FlowsTable rows={rows} team={team} pending={uninstallMutation.isPending} onUninstall={(f) => void uninstall(f)} />
            )
          }
        </Query>
      </Panel>

      <FormPanel
        ariaLabel={`Install a flow for ${team}`}
        heading="Install a flow"
        onSubmit={install}
        busy={installMutation.isPending}
        canSave={flow.trim().length > 0}
        saveLabel="Install"
        error={error}
      >
        <FieldGrid>
          <Field label="Flow" hint="Catalog name, e.g. sdlc-flow">
            {(p) => <Input {...p} value={flow} onChange={(e) => setFlow(e.target.value)} />}
          </Field>
          <Field label="Version" hint="Optional — defaults to the catalog's current version">
            {(p) => <Input {...p} value={version} onChange={(e) => setVersion(e.target.value)} />}
          </Field>
          <Field label="Agent name" hint="Optional — what the team sees">
            {(p) => <Input {...p} value={agentName} onChange={(e) => setAgentName(e.target.value)} />}
          </Field>
        </FieldGrid>
      </FormPanel>
    </>
  );
}

/** ITS OWN COMPONENT so it can hold the page state — the rows come from a `Query` render prop.
 *  `team` is the reset key: switching team lands on the first page of the new list. */
function FlowsTable({ rows, team, pending, onUninstall }: {
  rows: TeamFlowRow[]; team: string; pending: boolean; onUninstall: (flow: string) => void;
}) {
  const { page, controls } = usePaged(rows, team);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flow</TableHead>
            <TableHead>Version</TableHead>
            <TableHead hideBelow="md">Agent</TableHead>
            <TableHead className="text-right">Uninstall</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((f) => (
            <TableRow key={f.flow}>
              <TableCell className="break-all font-mono text-xs">{f.flow}</TableCell>
              <TableCell className="text-xs">{f.version || <span className="text-ink-faint">—</span>}</TableCell>
              <TableCell hideBelow="md" className="break-words text-xs">{f.agent}</TableCell>
              <TableCell className="text-right">
                <InlineDestructive
                  label="Uninstall"
                  question={`Uninstall ${f.flow} from ${team}?`}
                  confirmLabel="Uninstall"
                  pending={pending}
                  onConfirm={() => onUninstall(f.flow)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
