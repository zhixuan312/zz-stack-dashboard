'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '@/console/panel';
import { ApiError } from '@/lib/api';
import type { AskAnswer } from '@/lib/api-shapes';
import { citationHref } from '@/lib/citations';
import { consoleMutate } from '@/lib/mutate';

/** Whether a question can be sent at all: the one rule the page enforces; the gateway names every other refusal. */
export function canAsk(question: string): boolean {
  return question.trim().length > 0;
}

/**
 * A question in, an answer grounded in one team's own documents out, each claim traceable to a console link.
 *
 * One team, always: `team` is null exactly when the caller has not resolved to a single team, and the control
 * disables itself rather than guess, because `POST /ask` refuses `?scope=platform`. A failure keeps the gateway's
 * sentence in a banner that stays, not a toast that leaves before it is read. A citation is a link only when it
 * resolves; `path: null` is a real document this team's console cannot open, still named because the answer used it.
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
      setResult(await consoleMutate<AskAnswer>(`/ask?team=${encodeURIComponent(team)}`, { question: question.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the platform; try again.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <Panel title="Ask" description={team ? `Answered from ${team}'s folder` : 'Pick one team to answer from'}>
      <div className="flex flex-col gap-4">
        <Field label="Your question" hint="Specs, decisions, sources and knowledge nodes in the team's own folder.">
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              placeholder="What have we learned about…"
              value={question}
              disabled={!team || asking}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
          )}
        </Field>
        <div className="flex items-center gap-3">
          <Button variant="primary" icon={<Sparkles />} disabled={!team || !canAsk(question) || asking} onClick={() => void ask()}>Ask</Button>
          {asking ? <span className="flex items-center gap-2 text-sm text-ink-3"><Spinner size="sm" label="Asking" />Reading the team&apos;s documents…</span> : null}
        </div>
        {error ? <Banner tone="critical" title="Could not answer">{error}</Banner> : null}
        {result ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="t-body whitespace-pre-wrap text-ink">{result.answer}</p>
            {result.citations.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {result.citations.map((c, i) => (
                  <li key={`${c.path ?? c.title}-${i}`}>
                    {c.path && team
                      ? <Link href={citationHref(c.path, team)} className="link">{c.title}</Link>
                      : <span className="text-ink-3">{c.title} (not viewable from this team&apos;s console)</span>}
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
