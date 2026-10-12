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

/** Streams the model's answer to `messages`, about `page`, as a UI message stream response. `guard` is asked again as each approved change runs. */
export async function respond({ model, secret, messages, page, collections, views = [], guard, now }: { model: LanguageModel; secret: string; messages: UIMessage[]; page: PageContext; collections: AnyCollection[]; views?: ViewTool[]; guard: Guard; now: Date }): Promise<Response> {
  const modelMessages = await convertToModelMessages(messages);
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
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
