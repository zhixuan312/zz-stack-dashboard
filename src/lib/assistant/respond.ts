import { APICallError, RetryError, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type LanguageModel, type UIMessage } from 'ai';
import type { AnyCollection } from '@/lib/collection';
import type { ViewTool } from '@/lib/shared-context';
import { ChangeRefused, assistantTools, type Guard } from './tools';
import { readBrief } from './brief';
import { briefExcerpt, systemPrompt, type PageContext } from './prompt';

/**
 * What the assistant cannot do or see, said in its prompt so it can tell the person why rather than guess: the
 * operations only a page performs, the fields only a page shows, and what a collection does not allow at all.
 */
function limitsOf(collections: AnyCollection[]): string[] {
  return collections.flatMap((c) => {
    const label = c.label.toLowerCase();
    const pageOnly = (c.pageOnly ?? []) as string[];
    const missing = (['create', 'update', 'remove'] as const).filter((op) => !c[op]);
    return [
      ...(pageOnly.length ? [`${c.label}: ${pageOnly.join(' and ')} only on its page, by the person; you cannot propose it.`] : []),
      ...((c.hidden ?? []).length ? [`${c.label}: ${(c.hidden as string[]).join(', ')} is never shown to you or to any tool.`] : []),
      ...(missing.length ? [`${c.label}: nobody can ${missing.join(' or ')} ${label} here.`] : []),
    ];
  });
}

/** The most model steps one reply may take. */
const MAX_STEPS = 8;

/**
 * Who a reply was answered for: the caller's address and the team they acted for, null for none. Written on the first
 * part of every reply, so a reply cut off mid-stream is stamped too. COUPLED: `clearThreadOfAnother` in `src/lib/api.ts`
 * reads it back from the stored thread.
 */
type Stamp = { caller: string; team: string | null };

const stampOf = (m: UIMessage): Stamp | null => {
  const s = m.metadata as { caller?: unknown; team?: unknown } | undefined;
  return m.role === 'assistant' && typeof s?.caller === 'string' ? { caller: s.caller, team: typeof s.team === 'string' ? s.team : null } : null;
};

/**
 * The messages the model may read for `stamp`: those after the last reply stamped for another caller or team, so a
 * reply streamed into a thread after a switch, a thread another tab saved back or one stored before it hands the model
 * nothing of the old team or person. With nothing after that reply, the last question alone, answered as a first one.
 */
function forCaller(messages: UIMessage[], stamp: Stamp): UIMessage[] {
  const other = messages.findLastIndex((m) => {
    const s = stampOf(m);
    return s !== null && (s.caller !== stamp.caller || s.team !== stamp.team);
  });
  if (other < 0) return messages;
  const after = messages.slice(other + 1);
  if (after.length) return after;
  const question = messages.findLast((m) => m.role === 'user');
  return question ? [question] : [];
}

/**
 * Streams the model's answer to `messages`, about `page`, as a UI message stream response, stamped for `stamp` and read
 * only as far back as `forCaller` allows. `guard` is asked again as each approved change runs.
 */
export async function respond({ model, secret, messages, page, collections, views = [], guard, now, stamp }: { model: LanguageModel; secret: string; messages: UIMessage[]; page: PageContext; collections: AnyCollection[]; views?: ViewTool[]; guard: Guard; now: Date; stamp: Stamp }): Promise<Response> {
  const modelMessages = await convertToModelMessages(forCaller(messages, stamp));
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // The stamp is the reply's first part, before the model is reached, so whatever follows it is answered for this caller.
      writer.write({ type: 'start', messageMetadata: stamp });
      const { tools, toolApproval } = assistantTools(collections, writer, guard, views);
      const result = streamText({
        model,
        system: systemPrompt(page, now, briefExcerpt(readBrief()), limitsOf(collections)),
        tools,
        toolApproval,
        messages: modelMessages,
        experimental_toolApprovalSecret: secret,
        stopWhen: isStepCount(MAX_STEPS),
      });
      writer.merge(toUIMessageStream({ stream: result.stream, onError: plainError, sendStart: false }));
    },
    onError: plainError,
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * A refused change says why. Anything else is logged on the server and becomes one of three plain sentences, never
 * anything from the error itself.
 */
function plainError(error: unknown): string {
  if (error instanceof ChangeRefused) return error.message;
  console.error('assistant: model call failed', error);
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined;
  if (status === 401 || status === 403) return 'The assistant is not set up correctly: its provider refused the key. Ask whoever runs this console.';
  if (status === 429) return "The assistant's provider is busy. Try again in a minute.";
  return 'The assistant could not reach its provider. Try again.';
}
