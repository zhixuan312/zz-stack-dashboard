import { APICallError, RetryError, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type LanguageModel, type UIMessage } from 'ai';
import type { AnyCollection } from '@/lib/collection';
import type { ViewTool } from '@/lib/shared-context';
import { ChangeRefused, assistantTools, type Guard, type HandedExplore } from './tools';
import { readBrief } from './brief';
import { briefExcerpt, systemPrompt, type Audience, type PageContext } from './prompt';

/**
 * What the assistant cannot do or see, said in its prompt so it can tell the person why rather than guess: the
 * operations only a page performs, the fields only a page shows, and what a collection does not allow at all.
 */
function limitsOf(collections: AnyCollection[]): string[] {
  return collections.flatMap((c) => {
    const label = c.label.toLowerCase();
    const pageOnly = (c.pageOnly ?? []) as string[];
    // A page that writes through its own call implements nothing here; `pageOnly` still says the change is made there.
    const missing = (['create', 'update', 'remove'] as const).filter((op) => !c[op] && !pageOnly.includes(op));
    return [
      ...(pageOnly.length ? [`${c.label}: ${pageOnly.join(' and ')} only on its page, by the person; you cannot propose it.`] : []),
      ...((c.hidden ?? []).length ? [`${c.label}: ${(c.hidden as string[]).join(', ')} is never shown to you or to any tool.`] : []),
      ...(missing.length ? [`${c.label}: nobody can ${missing.join(' or ')} ${label} here.`] : []),
    ];
  });
}

/** The audience with the name of the prepared query `assistantTools` hands, when it hands one. */
function told(audience: Omit<Audience, 'explore'> | undefined, explore: HandedExplore | undefined): Audience | undefined {
  const name = explore ? `explore_${explore.view.name}` : undefined;
  if (!audience && !name) return undefined;
  return { ...audience, explore: name };
}

/** The most model steps one reply may take. */
const MAX_STEPS = 8;

/**
 * Streams the model's answer to `messages`, about `page`, as a UI message stream response. `collections` are those the
 * assistant is handed write tools for: the route hands the ones the page's prepared query reads. `readable` is every
 * collection the person may read, which the prompt's limits are said over, so the assistant can say why a change is not
 * one it can make on any of them; it is `collections` when not given. `guard` is asked again as each approved change
 * runs; `explore`, the page's prepared query, is handed as `explore_<view>`. `audience`, what the route worked out about
 * the person (the addresses they may open, what they may not read), is said in the prompt, with the prepared query's
 * name when one is handed.
 */
export async function respond({ model, secret, messages, page, collections, readable = collections, views = [], explore, guard, now, audience }: { model: LanguageModel; secret: string; messages: UIMessage[]; page: PageContext; collections: AnyCollection[]; readable?: AnyCollection[]; views?: ViewTool[]; explore?: HandedExplore; guard: Guard; now: Date; audience?: Omit<Audience, 'explore'> }): Promise<Response> {
  const modelMessages = await convertToModelMessages(messages);
  const stream = createUIMessageStream({
    // The thread as the panel holds it, so the SDK can tell this reply apart from a new turn. A thread ending in an
    // assistant message is that turn continuing — an answer to an approval — and the reply carries that message's id,
    // which is what makes the panel replace it rather than add a second one holding the same tool part. Without this
    // the change is drawn twice: the one being applied, and, forever, the one that says "Applying…".
    originalMessages: messages,
    execute: ({ writer }) => {
      const { tools, toolApproval } = assistantTools(collections, writer, guard, views, explore);
      const result = streamText({
        model,
        system: systemPrompt(page, now, briefExcerpt(readBrief()), limitsOf(readable), told(audience, explore)),
        tools,
        toolApproval,
        messages: modelMessages,
        experimental_toolApprovalSecret: secret,
        stopWhen: isStepCount(MAX_STEPS),
      });
      writer.merge(toUIMessageStream({ stream: result.stream, onError: plainError }));
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
