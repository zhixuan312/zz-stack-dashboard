'use client';

import { useMemo, useState } from 'react';
import { FileText, GitCompare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Panel } from '@/console/panel';
import { When } from '@/console/when';
import { cn } from '@/lib/cn';
import { collapse, diffLines, diffStat } from '@/lib/diff';
import { useConsole } from '@/lib/api';
import type { DocumentDetail, DocumentRevision } from '@/lib/api-shapes';

/** One snapshot's text, as the panel needs it.
 *
 * `body` is `undefined` while it is still being read, `null` when the snapshot carries no text,
 * and the text itself once it is in hand — three states, because "not read yet" and "read, and
 * empty" must not render alike. */
interface RevisionText { body: string | null | undefined; failed: boolean }

/**
 * One snapshot's own text, by its snapshot id (`revision`, never the public `version` — a version
 * can hold several snapshots): the document's body when this is the live snapshot, and otherwise a
 * read of that one snapshot.
 *
 * DELIBERATE: the history arrives as metadata and its texts are read one at a time. A document's
 * history has no bound — one on this deployment carries 109 revisions totalling 94 MB — and a
 * reader looking at one change needs the two texts it is drawn between, not all of them.
 *
 * The live revision is the document's own `body`, which the page already has: re-reading it would
 * be a second download of the same bytes.
 */
function useRevisionText(doc: DocumentDetail, revision: number | undefined): RevisionText {
  const live = revision !== undefined && revision === doc.current_revision;
  const q = useConsole<DocumentRevision>(
    revision === undefined || live
      ? null
      : `/document/${doc.team}/${doc.initiative}/${doc.path}?revision=${revision}`);
  if (revision === undefined) return { body: undefined, failed: false };
  if (live) return { body: doc.body ?? null, failed: false };
  if (q.isError) return { body: null, failed: true };
  return { body: q.data ? (q.data.body ?? null) : undefined, failed: false };
}

/**
 * How this document got to be what it is.
 *
 * A version happens because something was learned, and the platform records
 * both halves. The diff answers "what changed"; the sources beside it answer
 * "why" — every source declares the document it supports.
 */
export function VersionChain({ doc }: { doc: DocumentDetail }) {
  const sources = doc.sources ?? [];

  /* A step is a change of text, and the gateway sends one entry per public version.
   *
   * Two neighbouring versions can carry the same text: a version opened by a change to the
   * title, tags or other metadata alone, and, before versions followed their causes, a version
   * filed by an approval that edited nothing.
   *
   * Not a YAML question: the body is stored with the envelope already stripped, so
   * status, approved_at and the version number never reach this comparison — which is
   * why the fingerprint is the gateway's md5 of the body and not
   * `doc_revision.content_hash`, which covers the envelope and moves on an approval.
   *
   * Consecutive versions carrying the same text collapse into one step, and the step
   * remembers how many versions it spans. Fingerprints, not texts: the two texts a change
   * is drawn between are read only when it is opened. */
  const raw = doc.versions ?? [];
  const steps: { first: typeof raw[number]; last: typeof raw[number]; versions: number }[] = [];
  for (const v of raw) {
    const tail = steps[steps.length - 1];
    if (tail && tail.last.hash === v.hash) {
      tail.last = v;
      tail.versions += 1;
    } else {
      steps.push({ first: v, last: v, versions: 1 });
    }
  }

  // Newest first: a reader lands on the most recent real change.
  const pairs = steps.slice(1).map((s, i) => ({ before: steps[i], after: s })).reverse();
  const [at, setAt] = useState(0);
  const collapsed = raw.length - steps.length;
  const [openSource, setOpenSource] = useState<string | null>(null);
  // Newest first, like the pairs.
  const history = [...steps].reverse();
  const pair = pairs[at];

  /* The two texts this change is drawn between. The step's `last` is the newest version in it,
   * read by the snapshot that version is read as. */
  const before = useRevisionText(doc, pair?.before.last.revision);
  const after = useRevisionText(doc, pair?.after.last.revision);
  const ready = before.body !== undefined && after.body !== undefined;
  const failed = before.failed || after.failed;
  /* Memoised on the two texts, not run in the render body. The diff is the most expensive thing
   * this component does, and the component re-renders for reasons that have nothing to do with it:
   * its own change selector, a source expanded, and every re-render above it. `diffLines` trims the
   * common head and tail before it builds a table, so a pair that differs a little is cheap and one
   * that differs a lot is not — which is exactly the pair a reader goes looking for. */
  const { lines: shown, stat, truncated } = useMemo(() => {
    const lines = ready && !failed ? diffLines(before.body ?? '', after.body ?? '') : [];
    return { stat: diffStat(lines), ...collapse(lines) };
  }, [ready, failed, before.body, after.body]);

  if (raw.length < 2 && !sources.length) return null;

  const label = (v: { version: number }) => `v${v.version}`;
  /* A step spans every version that carried the same text, so it is named for
   * the range rather than for one end — "v3–v4". */
  const stepLabel = (s: { first: { version: number }; last: { version: number } }) =>
    s.first.version === s.last.version
      ? label(s.first)
      : `${label(s.first)}–${label(s.last)}`;

  // A fragment, so each panel is a card of the page's own stack rather than a card nested in a
  // column of this component's.
  return (
    <>
      {pair ? (
        <Panel
          title="Changes and their reasons"
          actions={
            <span className="flex items-center gap-3">
              {/* A Select, not a segmented strip: one segment per change grows with the
                  document's history, and a strip that cannot wrap pushes the card wider. */}
              {pairs.length > 1 ? (
                <Select size="sm" aria-label="Change" value={String(at)} onValueChange={(v) => setAt(Number(v))} options={pairs.map((p, i) => ({ value: String(i), label: `${stepLabel(p.before)} → ${stepLabel(p.after)}` }))} />
              ) : (
                <span className="font-mono text-xs text-ink-3">
                  {stepLabel(pair.before)} → {stepLabel(pair.after)}
                </span>
              )}
              {ready && !failed ? (
                stat.added || stat.removed ? (
                  <span className="whitespace-nowrap font-mono text-xs">
                    <span className="text-positive-ink">+{stat.added}</span>{' '}
                    <span className="text-critical-ink">−{stat.removed}</span>
                  </span>
                ) : (
                  // Said, rather than shown as +0 −0 and left to look like a bug.
                  <span className="whitespace-nowrap text-xs text-ink-3">identical</span>
                )
              ) : null}
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Why, above the diff: the sources are the reason the change exists, so they are
                read first. */}
            {sources.length ? (
              <div className="rounded-md border border-line bg-surface-sunk p-3">
                <p className="mb-2 t-eyebrow">
                  What this document was changed on
                </p>
                <ul className="flex flex-col gap-1.5">
                  {sources.map((s) => (
                    <li key={s.path}>
                      <button
                        type="button"
                        onClick={() => setOpenSource(openSource === s.path ? null : s.path)}
                        className="hit flex min-h-6 w-full items-baseline gap-2 text-left"
                      >
                        <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1 break-words text-sm text-accent-ink hover:underline">
                          {s.title || s.path.replace(/^sources\//, '')}
                        </span>
                        <span className="whitespace-nowrap font-mono text-2xs text-ink-3">
                          {s.added}
                        </span>
                      </button>
                      {openSource === s.path ? (
                        // The person's own words, verbatim, which is what a source is.
                        <p className="mt-2 max-w-[80ch] whitespace-pre-wrap break-words rounded-sm border-l-2 border-accent bg-surface px-3 py-2 text-sm leading-relaxed text-ink-2">
                          {s.body?.trim() || '(no text stored)'}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-ink-3">
                No source is attached to this document, so the record does not say what
                prompted the change.
              </p>
            )}

            {/* The change itself, once both of its texts are here. Nothing to show is said, not
                rendered as an empty diff: two versions can carry the same text, and running that
                through the diff produces a panel headed "what changed" containing "86 unchanged
                lines". */}
            {failed ? (
              <p className="rounded-md bg-surface-sunk px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">
                The text of one of these two versions could not be read, so the change cannot be
                shown. Nothing is missing from the document above.
              </p>
            ) : !ready ? (
              <p className="rounded-md bg-surface-sunk px-3.5 py-2.5 text-sm leading-relaxed text-ink-3">
                Reading the two versions this change is drawn between…
              </p>
            ) : !stat.added && !stat.removed ? (
              <p className="rounded-md bg-surface-sunk px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">
                <strong className="text-ink">{stepLabel(pair.after)}</strong> and{' '}
                <strong className="text-ink">{stepLabel(pair.before)}</strong> carry the same
                content.
                {pairs.length > 1 ? ' Pick an earlier change above.' : ''}
              </p>
            ) : (
            <div className="rounded-md border border-line">
              {/* `table-fixed`, or a long unbroken line sets the table's minimum width and
                  `break-words` never gets the chance to wrap it. */}
              <table className="w-full table-fixed border-collapse font-mono text-xs leading-[1.6]">
                {/* The widths live here: a fixed table sizes its columns from the first row, and
                    that is usually a one-cell "unchanged lines" row. */}
                <colgroup><col className="w-8" /><col /></colgroup>
                <tbody>
                  {shown.map((l, i) =>
                    l.op === 'skip' ? (
                      <tr key={i}>
                        <td className="bg-surface-sunk px-3 py-1 text-center text-2xs text-ink-3" colSpan={2}>
                          {l.n} unchanged {l.n === 1 ? 'line' : 'lines'}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={i}
                        className={cn(
                          l.op === 'add' && 'bg-positive-tint',
                          l.op === 'remove' && 'bg-critical-tint',
                        )}
                      >
                        <td className="select-none border-r border-line px-2 py-0.5 text-right align-top text-ink-3">
                          {l.op === 'add' ? '+' : l.op === 'remove' ? '−' : ''}
                        </td>
                        <td
                          className={cn(
                            'whitespace-pre-wrap break-words px-3 py-0.5',
                            l.op === 'add' && 'text-positive-ink',
                            l.op === 'remove' && 'text-critical-ink',
                            l.op === 'same' && 'text-ink-3',
                          )}
                        >
                          {l.text || ' '}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {/* A change with more in it than the panel draws. Said, not silently cut: the
                  count is the number of lines that were computed and left out. */}
              {truncated ? (
                <p className="border-t border-line px-3 py-2 text-xs leading-relaxed text-ink-3">
                  {truncated} further {truncated === 1 ? 'line' : 'lines'} changed and not shown —
                  this change is larger than the panel draws.
                </p>
              ) : null}
            </div>
            )}
          </div>
        </Panel>
      ) : sources.length ? (
        <Panel title="Sources behind the change" description={`${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`}>
          <ul className="flex flex-col gap-3">
            {sources.map((s) => (
              <li key={s.path}>
                <p className="break-words text-sm font-medium text-ink">{s.title || s.path}</p>
                <p className="mt-1 max-w-[80ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
                  {s.body?.trim()}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {raw.length > 1 ? (
        <Panel
          title="Content history"
          description={
            steps.length === 1
              ? `${raw.length} versions, all with the same text`
              : `${steps.length} changes of the text across ${raw.length} versions`
          }
          flush
        >
          <ul className="divide-y divide-line">
            {history.map((st) => (
              <li key={st.first.version} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <GitCompare className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                <span className="w-24 font-mono text-xs text-ink">{stepLabel(st)}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink-3">{st.first.path}</span>
                {/* A version that changed no text is a real fact and worth
                    seeing — just not as a separate change. */}
                {st.versions > 1 ? (
                  <span className="whitespace-nowrap text-2xs text-ink-3">
                    {st.versions} versions, same text
                  </span>
                ) : null}
                {st.last.status === 'approved' ? <Badge tone="positive" dot>Approved</Badge> : null}
                <span className="whitespace-nowrap font-mono text-2xs text-ink-3">
                  <When at={st.last.updated_at} />
                </span>
              </li>
            ))}
          </ul>
          {collapsed ? (
            <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-ink-3">
              {collapsed} {collapsed === 1 ? 'version is' : 'versions are'} listed with the one
              before {collapsed === 1 ? 'it' : 'them'}: the text is the same, and what changed was
              the title, tags or other metadata, or, before versions followed their causes, only
              an approval.
            </p>
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}
