// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Work guide's "Find a decision" (Task I-128, AC-8.3): search Knowledge for a phrase from an old plan, then ask the
 * assistant the same thing, and it cites the same document.
 *
 * The assistant's search is the view tool the route hands a model, `searchTool` (`src/views/tools/search.ts`), its
 * `read` called as the route calls it, with the person's session mocked as tests/assistant-tool-sweep.test.ts mocks it:
 * the console server's cookie jar holds the session value the browser journey signs in with. The fixture runs as its own
 * server. The page's first hit is what the Knowledge page reads for the same question (`searchPath`, the read
 * `src/views/pages/knowledge.tsx` makes) and links (`hitAddress`), so the two addresses compared are the two a person
 * would follow. scripts/journeys.ts prints the page's own link from the browser.
 *
 * The browser journey asks the assistant itself, which `pnpm verify --full` points at the fake model with the steps of
 * `fakeModel` (scripts/verify.config.ts). Here the same two turns are made without a browser: the fake model is asked the
 * phrase with the search tool handed, calls it, is handed the tool's result as the assistant's route hands it
 * (`{ address, context }`, `src/lib/assistant/tools.ts`), and answers; the address that answer cites, read as the
 * journey reads it (`citedAddress`), is the page's first hit.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }) }));

import type { SearchAnswer } from '@/lib/api-shapes';
import { contextText } from '@/lib/shared-context';
import { searchPath } from '@/views/knowledge-context';
import { hitAddress } from '@/views/search-context';
import { searchTool } from '@/views/tools/search';
import { startFakeLlm } from '../scripts/fake-llm.ts';
import { citedAddress } from '../scripts/journeys.ts';
import config from '../scripts/verify.config.ts';
import guide from './fixtures/guide-tasks.json';
import { startFakeGateway } from './fake-gateway-start';

/** The journey's session, which scripts/journeys.ts signs the member in with for Work's tasks. */
const SESSION = 'member+journey';
const PHRASE = guide.tasks.find((t) => t.id === 'work-4')!.phrase!;

let fixture: Awaited<ReturnType<typeof startFakeGateway>> | undefined;
beforeAll(async () => { fixture = await startFakeGateway(); });
afterAll(() => fixture?.proc.kill());

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, { ZZ_GATEWAY: fixture!.base, NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
  jar.zz_console = SESSION;
});
afterEach(() => { process.env = { ...saved }; });

describe('the assistant finds the decision the Knowledge page finds', () => {
  it('answers the phrase from an old plan with the document the page\'s first hit links to', async () => {
    const res = await fetch(`${fixture!.base}/api/console${searchPath(PHRASE)}`, { headers: { cookie: `zz_console=${SESSION}` } });
    expect(res.status).toBe(200);
    const page = (await res.json()) as SearchAnswer;
    const first = page.results[0];
    expect(first, 'the page finds something for the phrase').toBeDefined();
    expect(first.kind).toBe('document');
    expect(first.path).toBe('plan.md');

    const { data, context } = await searchTool.read({ q: PHRASE });
    expect(data.results.length).toBeGreaterThan(0);
    expect(hitAddress(data.results[0])).toBe(hitAddress(first));
    // The model is told that address: it is the first result's evidence in the context the tool hands it.
    expect(context.insights[0].evidence).toBe(hitAddress(first));
  });

  it("cites the page's first hit when the assistant is asked the phrase, through the fake model's step", async () => {
    const res = await fetch(`${fixture!.base}/api/console${searchPath(PHRASE)}`, { headers: { cookie: `zz_console=${SESSION}` } });
    const first = ((await res.json()) as SearchAnswer).results[0];
    const llm = await startFakeLlm({ port: 0, steps: config.fakeModel });
    try {
      const ask = async (messages: object[]) => (await (await fetch(`${llm.url}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'fake', messages, tools: [{ type: 'function', function: { name: 'view_search' } }] }),
      })).json()).choices[0].message;
      const question = [{ role: 'system', content: 'Page: Knowledge (/knowledge)' }, { role: 'user', content: PHRASE }];
      const call = (await ask(question)).tool_calls?.[0];
      expect(call?.function.name, 'the fake model calls the search the step names').toBe('view_search');
      const input = JSON.parse(call.function.arguments);
      expect(input).toEqual({ q: PHRASE });

      const { context } = await searchTool.read(input);
      const result = { address: context.address, context: contextText(context) };
      const answer = await ask([...question, { role: 'assistant', content: null, tool_calls: [call] }, { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) }]);
      expect(citedAddress(String(answer.content))).toBe(hitAddress(first));
    } finally {
      await llm.close();
    }
  });
});
