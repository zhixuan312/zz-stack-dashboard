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
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }) }));

import type { SearchAnswer } from '@/lib/api-shapes';
import { searchPath } from '@/views/knowledge-context';
import { hitAddress } from '@/views/search-context';
import { searchTool } from '@/views/tools/search';
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
});
