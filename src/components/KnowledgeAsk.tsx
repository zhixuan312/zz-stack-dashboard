'use client';

import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Panel } from '@/components/Panel';
import {
  Banner, Button, Field, Spinner, Textarea,
} from '@/components/ui';
import { ApiError } from '@/lib/api';
import { type AskAnswer } from '@/lib/api-shapes';
import { consoleMutate } from '@/lib/mutate';
import { citationHref } from '@/lib/citations';

/** Whether a question can be submitted at all — the only rule the surface itself enforces,
 *  the server names every other refusal in its own sentence. Exported (not just used
 *  inline) so the disabled state on the button and the test asserting the same thing call
 *  the one function, never two copies of "is this blank" that could drift apart. */
export function canAsk(question: string): boolean {
  return question.trim().length > 0;
}

/**
 * The ask surface on the Knowledge page (Task I-24, AC-8/AC-9): a question in, an answer
 * grounded in this team's own documents out, each claim traceable to a real console link.
 *
 * ONE TEAM, ALWAYS. `team` is `null` exactly when the caller has not resolved to a single
 * team — platform mode with "All" selected — and the control disables itself rather than
 * guess one: `POST /api/console/ask` refuses `?scope=platform` outright (a question is
 * answered from ONE team's knowledge, never a fleet-wide reading of it — see
 * console-ask.ts), so there is no team this call could send that the server would accept.
 *
 * NO OPTIMISTIC ANSWER, AND NO SILENT WAIT: `asking` renders its own inline state (a
 * spinner and a sentence) rather than leaving the panel exactly as it was until the
 * response lands — a blank pause here reads as a broken page. A failure keeps the
 * SERVER's own sentence verbatim, `Banner`'s persistent description rather than a toast
 * that vanishes before an operator can read the missing-credential name in a 503.
 *
 * CITATIONS RENDER AS LINKS ONLY WHEN THEY RESOLVE. `c.path === null` means the gateway
 * found a real document but not one this team's console can open (its own shared platform
 * shelf — see `console-ask.ts`'s `buildCitations`); that title is still shown, as plain
 * text, because the answer really was grounded in it — a citation is not an invented one
 * just because this page has nowhere to send a reader today.
 */
export function KnowledgeAsk({ team }: { team: string | null }) {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskAnswer | null>(null);

  async function ask() {
    if (!team || !canAsk(question)) return;
    setAsking(true);
    setError(null);
    setResult(null);
    try {
      const r = await consoleMutate<AskAnswer>(
        `/ask?team=${encodeURIComponent(team)}`,
        { question: question.trim() },
      );
      setResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the ask feature — try again.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <Panel
      title="Ask"
      aside={team ? undefined : 'Pick one team to ask a question'}
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Ask your team's knowledge"
          hint="Answered from documents in this team's own folder — specs, decisions, sources, knowledge nodes."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              placeholder="What have we learned about…"
              value={question}
              disabled={!team || asking}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Enter submits, Shift+Enter (or any IME composition) writes a newline —
                // the same split a chat composer uses, and a question is usually one line.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
          )}
        </Field>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            leftIcon={<Sparkles />}
            disabled={!team || !canAsk(question) || asking}
            onClick={() => void ask()}
          >
            Ask
          </Button>
          {asking ? (
            <span className="flex items-center gap-2 text-xs text-ink-faint">
              {/* The mascot stands in for the spinner ONLY here — this is the one screen
                  where a person waits on an answer rather than on a button. `Spinner` is
                  untouched and still imported: if the image fails, it is what shows. */}
              <Image
                src="/assets/brand/state-thinking.png"
                alt=""
                width={72}
                height={90}
                className="h-12 w-auto object-contain"
              />
              <Spinner size="sm" label="Asking" className="sr-only" />
              Asking your team&apos;s knowledge…
            </span>
          ) : null}
        </div>

        {error ? (
          <Banner variant="danger" title="Could not answer" description={error} />
        ) : null}

        {result ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink-soft">
              {result.answer}
            </p>
            {result.citations.length ? (
              <ul className="flex flex-col gap-1 border-t border-line pt-2 text-xs">
                {result.citations.map((c, i) => (
                  <li key={`${c.path ?? c.title}-${i}`}>
                    {c.path && team ? (
                      <Link href={citationHref(c.path, team)} className="text-accent hover:underline">
                        {c.title}
                      </Link>
                    ) : (
                      <span className="text-ink-faint">
                        {c.title} <span className="italic">(not viewable from this team&apos;s console)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
