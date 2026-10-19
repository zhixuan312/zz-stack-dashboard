'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { Busy } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { KeyValue } from '@/components/ui/key-value';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { ApiError } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { useConsoleMutation } from '@/lib/mutate';
import type { BugReport, BugResolveInput } from '@/lib/platform-shapes';
import { pendingContext } from '@/views/context';
import {
  bugContext, bugPath, bugsTrouble, duplicatesPath, impactOf, statusOf, type BugDuplicates, type BugRead, type DuplicatesRead,
} from '@/views/platform-bugs-context';
import { useServed } from '@/views/use-served';

type Trouble = Exclude<BugRead, { state: 'ok' }>;
type Outcome = BugResolveInput['status'];

/**
 * The page's two reads, the report and its duplicate targets: the ones the console's server made, so the first paint
 * carries both and the browser asks for nothing more, then the browser's own once a Retry or a resolution asks for
 * them. An id that names no report reached the page only from the browser's read, since the server's answers it with
 * the missing page.
 */
function useBug(id: string, served: BugRead, servedTargets: DuplicatesRead) {
  const { q, error, retry, busy } = useServed<BugReport>(bugPath(id), true);
  const targets = useServed<BugDuplicates>(duplicatesPath(id), true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf({ error });
  // A read in flight keeps the state the last one ended in on screen, and its Retry, so a press or a change answers
  // there rather than swapping it for a skeleton and taking a keyboard user's place with it.
  const trouble: Trouble | null = data ? null
    : error?.status === 404 ? { state: 'missing' }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' ? null : served;
  const duplicates: DuplicatesRead = targets.q.data ? { state: 'ok', data: targets.q.data }
    : failureOf(targets) ? { state: 'failed', reason: failureOf(targets)! } : servedTargets;
  return { data, duplicates, trouble, retry, busy };
}

/**
 * One bug report, the superadmin's alone, titled by itself in the masthead: the reporter's words, the page's protagonist, beside what it is
 * (its impact, surface, team, version and when it was filed), then what was decided, or, while it is open, the form
 * that resolves it. The form posts `bug_resolve`'s arguments through the console's write path; a refusal keeps what was
 * typed and says the gateway's sentence. Nothing here deletes a report.
 */
export function PlatformBugView({ id, served, duplicates: servedTargets }: { id: string; served: BugRead; duplicates: DuplicatesRead }) {
  const { data, duplicates, trouble, retry, busy } = useBug(id, served, servedTargets);
  useShareView(data
    ? bugContext(data, duplicates.state === 'ok' ? duplicates.data : null)
    : pendingContext({ view: 'bug', title: 'Bug report', address: bugPath(id), scope: 'one bug report' }, trouble && trouble.state !== 'missing' ? bugsTrouble(trouble) : null));

  if (!data) return trouble ? <BugTrouble trouble={trouble} busy={busy} onRetry={retry} /> : <Busy name="bug"><Row split="2/3"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></Row></Busy>;
  // The page's title is the report's own when the server read it; a report read only in the browser says it here.
  const titled = served.state === 'ok' && served.data.title === data.title;
  return (
    <Stack>
      <Row split="2/3" className="items-start">
        <Panel
          data-protagonist="Report"
          title="Report"
          description={`Filed ${formatDateTime(data.reportedAt)}, in the reporter's own words`}
          actions={<AskAbout question="What does this report say is broken, what would resolve it, and is it a duplicate of another report of its team?" />}
        >
          {titled ? null : <p className="mb-3 font-medium text-ink [overflow-wrap:anywhere]">{data.title}</p>}
          <p data-report-detail className="t-body whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{data.detail}</p>
        </Panel>
        <Panel title="This report" description={statusOf(data.status)}>
          <KeyValue items={[
            { label: 'Impact', value: impactOf(data.impact) },
            { label: 'Surface', value: data.surface ?? 'None named', wrap: true },
            { label: 'Team', value: data.team ?? 'No team' },
            { label: 'Filed against', value: data.platformVersion ?? 'Not recorded' },
            { label: 'Filed', value: formatDateTime(data.reportedAt) },
            ...(data.resolvedAt ? [{ label: 'Resolved', value: formatDateTime(data.resolvedAt) }] : []),
          ]} />
        </Panel>
      </Row>
      {data.status === 'open' ? <Resolve report={data} duplicates={duplicates} /> : <Decision report={data} />}
    </Stack>
  );
}

/** What was decided, as `bug_resolve` recorded it: the outcome, the reasoning and the report it duplicates. */
function Decision({ report }: { report: BugReport }) {
  return (
    <Panel title="Decision" description={`${statusOf(report.status)}${report.resolvedAt ? `, ${formatDateTime(report.resolvedAt)}` : ''}`}>
      <p className="t-body whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{report.resolution ?? 'No reasoning was recorded.'}</p>
      {report.duplicateOf ? (
        <p className="t-small mt-3 text-ink-2">
          Duplicate of <Link href={bugPath(report.duplicateOf)} className="hit rounded-xs font-mono text-accent-ink hover:text-ink [overflow-wrap:anywhere]">{report.duplicateOf}</Link>
        </p>
      ) : null}
    </Panel>
  );
}

/** Why a report cannot be closed as a duplicate here, or null when it can. */
function noTargets(duplicates: DuplicatesRead): string | null {
  if (duplicates.state !== 'ok') return `Its team's reports could not be read: ${bugsTrouble(duplicates)}`;
  return duplicates.data.rows.length ? null : 'No other report of its team exists.';
}

/**
 * The resolve form: an outcome, what was decided and why, and for a duplicate the report it duplicates, chosen from the
 * duplicates read alone, which are the reports `bug_resolve` would accept. The body is exactly `bug_resolve`'s
 * arguments, and the control stays disabled until they are whole.
 */
function Resolve({ report, duplicates }: { report: BugReport; duplicates: DuplicatesRead }) {
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [resolution, setResolution] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resolve = useConsoleMutation<void, BugResolveInput>((body) => ({ path: `${bugPath(report.id)}/resolve`, method: 'POST', body }));
  const rows = duplicates.state === 'ok' ? duplicates.data.rows : [];
  const blocked = noTargets(duplicates);
  const chosen = rows.find((r) => r.id === target);
  const ready = outcome !== '' && resolution.trim().length > 0 && (outcome !== 'duplicate' || chosen !== undefined);

  async function submit() {
    if (!ready) return;
    setError(null);
    const body: BugResolveInput = outcome === 'duplicate'
      ? { status: 'duplicate', resolution: resolution.trim(), duplicate_of: chosen!.id }
      : { status: outcome, resolution: resolution.trim() };
    try {
      await resolve.mutateAsync(body);
      toast({ tone: 'positive', title: `Closed as ${statusOf(body.status).toLowerCase()}` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The report was not resolved; try again.');
    }
  }

  return (
    <Panel title="Resolve" description="Close the report with what was decided and why. A closed report is not reopened.">
      <form className="flex max-w-2xl flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <RadioGroup
          aria-label="Outcome"
          value={outcome}
          onValueChange={(v) => setOutcome(v as Outcome)}
          options={[
            { value: 'fixed', label: 'Fixed', description: 'A change resolved it; say which.' },
            { value: 'not_a_bug', label: 'Not a bug', description: 'It works as intended; say why.' },
            { value: 'duplicate', label: 'Duplicate', description: blocked ?? 'Another report of its team says the same.', disabled: blocked !== null },
          ]}
        />
        {outcome === 'duplicate' ? (
          <Field label="Duplicate of" required hint={chosen ? <span className="[overflow-wrap:anywhere]">{chosen.title}</span> : 'One of the other reports of its team, newest first.'}>
            {(p) => (
              <Select
                {...p}
                value={target}
                onValueChange={setTarget}
                placeholder="Choose a report"
                options={rows.map((r) => ({ value: r.id, label: r.title, description: `${statusOf(r.status)}, filed ${formatDate(r.reportedAt)}` }))}
              />
            )}
          </Field>
        ) : null}
        <Field label="What was decided, and why" required>
          {(p) => <Textarea {...p} rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} />}
        </Field>
        {error ? <p role="alert" className="t-small text-critical-ink [overflow-wrap:anywhere]">{error}</p> : null}
        <div>
          <Button type="submit" variant="primary" busy={resolve.isPending} disabled={!ready}>Resolve report</Button>
        </div>
      </form>
    </Panel>
  );
}

function BugTrouble({ trouble, busy, onRetry }: { trouble: Trouble; busy: boolean; onRetry: () => void }) {
  return (
    <Card>
      {trouble.state === 'missing' ? (
        <EmptyState kind="filtered" title="No report of this id is recorded" className="py-16" action={<Button size="sm" asChild><Link href="/platform/bugs">All reports</Link></Button>}>Bugs lists every report the platform has recorded.</EmptyState>
      ) : (
        <EmptyState kind="error" title={trouble.state === 'slow' ? 'The report is unavailable' : 'The report did not load'} className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={busy} onClick={onRetry}>Retry</Button>}>{bugsTrouble(trouble)}</EmptyState>
      )}
    </Card>
  );
}
