'use client';

import { Prose } from '../prose/index';

/**
 * One text part of an assistant reply: the model's markdown, read by the same safe reader as the rest of the product.
 *
 * Every model this template has been pointed at answers in markdown, so a plain paragraph shows `**bold**`, `- `
 * bullets and `|---|` table rules literally. `Prose` renders it, and it is the reader that is already safe for content
 * nobody vetted: raw HTML stays text and every URL passes `safeMarkdownUrl`, so an answer cannot smuggle markup or a
 * `javascript:` link into the panel.
 *
 * The wrapper carries `data-assistant-text` because a reply can now be a list, a table or a code block: a check that
 * reads the reply has one stable handle instead of guessing which element the text ended up in.
 *
 * The first and last child margins are trimmed: a markdown paragraph carries `my-3`, which would push the reply away
 * from its "Assistant" caption and the next message in the thread's 16px rhythm.
 */
export function AssistantText({ text }: { text: string }) {
  return (
    <div data-assistant-text className="min-w-0">
      <Prose size="sm" className="max-w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{text}</Prose>
    </div>
  );
}
