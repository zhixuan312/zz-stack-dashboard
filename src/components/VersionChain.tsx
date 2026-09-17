'use client';

import { useState } from 'react';
import { FileText, GitCompare } from 'lucide-react';
import { Panel } from '@/components/Panel';
import {
  Badge, PageControl, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Time, usePaged,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { collapse, diffLines, diffStat } from '@/lib/diff';
import type { DocumentDetail } from '@/lib/api';

/**
 * How this document got to be what it is.
 *
 * A document store's whole argument is that a revision happens BECAUSE something
 * was learned — a stakeholder answered, an interview landed, a probe came back.
 * The platform records both halves and the console showed neither: you could see
 * that `_versions/spec.v1.md` existed and never what made v2 different, nor what
 * anybody said that caused it.
 *
 * So the two are shown together. The diff answers "what changed"; the sources
 * beside it answer "why", and they are not a guess — every source declares the
 * document it supports and the platform has always written it down.
 */
/** The version numbers that were used and never frozen.
 *
 * `_versions/` freezes one copy per APPROVAL, and the version counter advances on every
 * REVISION — so a draft revised again before anyone approved it consumes a number and leaves
 * no file. The list then reads v1, v3, v4, and the missing number is explained nowhere, which
 * reads as data loss rather than as the rule working.
 *
 * It is not loss: nothing was ever signed at v2, and `_versions/` is the record of what was
 * signed. But "there is no v2 here" and "v2 never existed" are different statements, and the
 * page was making neither.
 *
 * Derived from the numbers already on the page — no new endpoint and no event stream. The
 * live document's 9999 sentinel is not a snapshot number, so it is excluded from the range;
 * counting it would report thousands of missing versions on every document.
 *
 * Exported because it is the whole rule, and a rule is worth a test.
 */
export function unretainedVersions(versions: number[]): number[] {
  const kept = versions.filter((n) => n !== 9999);
  if (!kept.length) return [];
  return Array.from({ length: Math.max(...kept) }, (_, i) => i + 1)
    .filter((n) => !kept.includes(n));
}

export function VersionChain({ doc }: { doc: DocumentDetail }) {
  const sources = doc.sources ?? [];

  /* A VERSION IS A CONTENT CHANGE, not a snapshot.
   *
   * The store freezes a copy every time a document is APPROVED, so approving a
   * document without editing it produces a new numbered file whose content is
   * identical to the one before. Listing those as versions made the page claim a
   * change that never happened, and left a reader comparing "v4" against
   * "current" and being told they were the same — which is true and says nothing.
   *
   * Not a YAML question. zz.doc.body is stored with the envelope already
   * stripped, so status, approved_at and the version number never reach this
   * comparison. Two snapshots that differ only in frontmatter ARE the same
   * content, and that is the whole point: approval is given to the content, and
   * nobody approves a frontmatter field.
   *
   * So consecutive snapshots carrying the same content collapse into one step,
   * and the step remembers how many approvals it accumulated — because "approved
   * three times without an edit" is a real fact about a document and is worth
   * seeing, just not as three versions. */
  const raw = doc.versions ?? [];
  const steps: { first: typeof raw[number]; last: typeof raw[number]; snapshots: number }[] = [];
  for (const v of raw) {
    const tail = steps[steps.length - 1];
    if (tail && (tail.last.body ?? '') === (v.body ?? '')) {
      tail.last = v;
      tail.snapshots += 1;
    } else {
      steps.push({ first: v, last: v, snapshots: 1 });
    }
  }
  const missing = unretainedVersions(raw.map((v) => v.version));

  // Newest first: a reader lands on the most recent real change.
  const pairs = steps.slice(1).map((s, i) => ({ before: steps[i], after: s })).reverse();
  const [at, setAt] = useState(0);
  const collapsed = raw.length - steps.length;
  const [openSource, setOpenSource] = useState<string | null>(null);
  // Newest first, like the pairs.
  const { page: stepPage, controls } = usePaged([...steps].reverse());

  if (raw.length < 2 && !sources.length) return null;

  const pair = pairs[at];
  const lines = pair ? diffLines(pair.before.last.body ?? '', pair.after.last.body ?? '') : [];
  const stat = diffStat(lines);
  const shown = collapse(lines);

  const label = (v: { version: number }) => (v.version === 9999 ? 'current' : `v${v.version}`);
  /* A step spans every snapshot that carried the same content, so it is named for
   * the range rather than for one of them — "v3–current" says more honestly what
   * the reader is looking at than either end alone. */
  const stepLabel = (s: { first: { version: number }; last: { version: number } }) =>
    s.first.version === s.last.version
      ? label(s.first)
      : `${label(s.first)}–${label(s.last)}`;

  // A FRAGMENT, so each panel is a card of the page's own stack rather than a card nested in
  // a column of this component's.
  return (
    <>
      {pair ? (
        <Panel
          title="Changes and their reasons"
          aside={
            <span className="flex items-center gap-3">
              {/* A SELECT, not a segmented strip: one segment per change grows with the
                  document's history, and a strip that cannot wrap pushes the card wider. */}
              {pairs.length > 1 ? (
                <Select value={String(at)} onValueChange={(v) => setAt(Number(v))}>
                  <SelectTrigger className="w-[11rem]" aria-label="Change">
                    <SelectValue>{`${stepLabel(pairs[at].before)} → ${stepLabel(pairs[at].after)}`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pairs.map((p, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {stepLabel(p.before)} → {stepLabel(p.after)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-mono text-xs text-ink-faint">
                  {stepLabel(pair.before)} → {stepLabel(pair.after)}
                </span>
              )}
              {stat.added || stat.removed ? (
                <span className="whitespace-nowrap font-mono text-xs">
                  <span className="text-[var(--sage-deep)]">+{stat.added}</span>{' '}
                  <span className="text-[var(--rose-deep)]">−{stat.removed}</span>
                </span>
              ) : (
                // Said, rather than shown as +0 −0 and left to look like a bug.
                <span className="whitespace-nowrap text-xs text-ink-faint">identical</span>
              )}
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            {/* WHY, above the diff. The sources are the reason the change exists,
                so they are read first — a diff with no cause is a list of edits. */}
            {sources.length ? (
              <div className="rounded-[var(--r)] border border-line bg-surface-2 p-3">
                <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">
                  What this document was changed on
                </p>
                <ul className="flex flex-col gap-1.5">
                  {sources.map((s) => (
                    <li key={s.path}>
                      <button
                        type="button"
                        onClick={() => setOpenSource(openSource === s.path ? null : s.path)}
                        className="flex w-full items-baseline gap-2 text-left"
                      >
                        <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        <span className="min-w-0 flex-1 break-words text-[13px] text-accent hover:underline">
                          {s.title || s.path.replace(/^sources\//, '')}
                        </span>
                        <span className="whitespace-nowrap font-mono text-[11px] text-ink-faint">
                          {s.added}
                        </span>
                      </button>
                      {openSource === s.path ? (
                        // The person's own words, verbatim, which is what a source IS.
                        <p className="mt-2 max-w-[80ch] whitespace-pre-wrap break-words rounded-[var(--r-sm)] border-l-2 border-accent bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                          {s.body?.trim() || '(no text stored)'}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-ink-faint">
                No source is attached to this document, so the record does not say what
                prompted the change.
              </p>
            )}

            {/* NOTHING TO SHOW IS SAID, not rendered as an empty diff.
                A version is snapshotted when a document is approved, so a document
                approved once and never revised has a v1 byte-identical to the live
                file. Running that through the diff produced a panel headed "what
                changed" containing "86 unchanged lines" — technically true, useless,
                and it reads as a broken page rather than as an answer. */}
            {!stat.added && !stat.removed ? (
              <p className="rounded-[var(--r)] bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                <strong className="text-ink">{stepLabel(pair.after)}</strong> and{' '}
                <strong className="text-ink">{stepLabel(pair.before)}</strong> carry the same
                content.
                {pairs.length > 1 ? ' Pick an earlier change above.' : ''}
              </p>
            ) : (
            <div className="rounded-[var(--r)] border border-line">
              {/* `table-fixed`, or a long unbroken line sets the table's minimum width and
                  `break-words` never gets the chance to wrap it. */}
              <table className="w-full table-fixed border-collapse font-mono text-[12px] leading-[1.6]">
                {/* THE WIDTHS LIVE HERE: a fixed table sizes its columns from the first row,
                    and that is usually a one-cell "unchanged lines" row. */}
                <colgroup><col className="w-8" /><col /></colgroup>
                <tbody>
                  {shown.map((l, i) =>
                    l.op === 'skip' ? (
                      <tr key={i}>
                        <td className="bg-surface-2 px-3 py-1 text-center text-[11px] text-ink-faint" colSpan={2}>
                          {l.n} unchanged {l.n === 1 ? 'line' : 'lines'}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={i}
                        className={cn(
                          l.op === 'add' && 'bg-[var(--sage-tint)]',
                          l.op === 'remove' && 'bg-[var(--rose-tint)]',
                        )}
                      >
                        <td className="select-none border-r border-line px-2 py-0.5 text-right align-top text-ink-faint">
                          {l.op === 'add' ? '+' : l.op === 'remove' ? '−' : ''}
                        </td>
                        <td
                          className={cn(
                            'whitespace-pre-wrap break-words px-3 py-0.5',
                            l.op === 'add' && 'text-[var(--sage-deep)]',
                            l.op === 'remove' && 'text-[var(--rose-deep)]',
                            l.op === 'same' && 'text-ink-faint',
                          )}
                        >
                          {l.text || ' '}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </Panel>
      ) : sources.length ? (
        <Panel title="Sources behind the change" aside={`${sources.length} source(s)`}>
          <ul className="flex flex-col gap-3">
            {sources.map((s) => (
              <li key={s.path}>
                <p className="break-words text-[13px] font-medium text-ink">{s.title || s.path}</p>
                <p className="mt-1 max-w-[80ch] whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-soft">
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
          aside={
            steps.length === 1
              ? `one version of the content, ${raw.length} approvals`
              : `${steps.length} versions of the content across ${raw.length} snapshots`
          }
          padded={false}
        >
          <ul className="divide-y divide-line">
            {missing.length ? (
              <li className="px-4 py-2.5 text-[12px] leading-relaxed text-ink-faint">
                <span className="font-mono text-ink-soft">
                  v{missing.join(', v')}
                </span>{' '}
                {missing.length === 1 ? 'is' : 'are'} not listed: the store freezes a copy when a
                document is APPROVED, and the version number advances on every REVISION.{' '}
                {missing.length === 1 ? 'That version was' : 'Those versions were'} revised again
                before {missing.length === 1 ? 'it was' : 'they were'} ever approved, so no copy
                was kept and nobody signed {missing.length === 1 ? 'it' : 'them'}. What changed
                across {missing.length === 1 ? 'it' : 'them'} is inside the next step below.
              </li>
            ) : null}
            {stepPage.map((st) => (
              <li key={st.first.path} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <GitCompare className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                <span className="w-24 font-mono text-xs text-ink">{stepLabel(st)}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink-faint">{st.first.path}</span>
                {/* An approval that changed nothing is a real fact and worth
                    seeing — just not as a separate version. */}
                {st.snapshots > 1 ? (
                  <span className="whitespace-nowrap text-[11px] text-ink-faint">
                    approved {st.snapshots}× without an edit
                  </span>
                ) : null}
                {st.last.status === 'approved' ? <Badge variant="sage" dot>approved</Badge> : null}
                <span className="whitespace-nowrap font-mono text-[11px] text-ink-faint">
                  <Time value={st.last.updated_at} />
                </span>
              </li>
            ))}
          </ul>
          {collapsed ? (
            <p className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-ink-faint">
              {collapsed} {collapsed === 1 ? 'snapshot is' : 'snapshots are'} not listed
              separately: the store freezes a copy every time a document is approved, and{' '}
              {collapsed === 1 ? 'that one carries' : 'those carry'} the same content as the
              version above. Approval is given to the content, so an approval that changed no
              content is not a new version of it.
            </p>
          ) : null}
          <PageControl {...controls} />
        </Panel>
      ) : null}
    </>
  );
}
