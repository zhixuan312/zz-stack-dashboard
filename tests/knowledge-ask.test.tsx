import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { canAsk, KnowledgeAsk } from '@/components/KnowledgeAsk';
import { citationHref } from '@/lib/citations';
import { consoleMutate } from '@/lib/mutate';

// The one network call this component makes goes through `consoleMutate` — mocked here
// rather than the module's underlying `fetch`, the same boundary `ApproveAction`'s and
// `DocumentThread`'s own tests would mock if they needed a mutation's result at all (they
// don't; this component is the first that renders what a mutation returns).
vi.mock('@/lib/mutate', () => ({ consoleMutate: vi.fn() }));

const mockedMutate = vi.mocked(consoleMutate);

/**
 * `citationHref` — the pure translation from the gateway's raw store path
 * (`console-ask.ts`'s `buildCitations`) to a route this app actually has.
 */
describe('citationHref', () => {
  it('routes a knowledge node to the knowledge page, opened by team/path', () => {
    expect(citationHref('_knowledge/nodes/0007-x.md', 'product-1')).toBe(
      '/knowledge?open=product-1%2Fnodes%2F0007-x.md',
    );
  });

  it('routes any other document to its initiative page', () => {
    expect(citationHref('2026-09-08-console-as-an-interface/plan.md', 'product-1')).toBe(
      '/initiatives/product-1/2026-09-08-console-as-an-interface/plan.md',
    );
  });

  it('carries a nested path through unencoded slashes intact', () => {
    expect(citationHref('init-1/sources/foo.md', 'product-1')).toBe(
      '/initiatives/product-1/init-1/sources/foo.md',
    );
  });
});

/**
 * `canAsk` — the one client-side rule the ask surface itself enforces; every other
 * refusal (no team, zz-core down, the model unconfigured) is the server's own sentence,
 * never guessed here.
 */
describe('canAsk', () => {
  it('refuses a blank question', () => {
    expect(canAsk('')).toBe(false);
  });

  it('refuses whitespace-only', () => {
    expect(canAsk('   \n\t ')).toBe(false);
  });

  it('admits a real question', () => {
    expect(canAsk('what did we learn about retries?')).toBe(true);
  });
});

describe('KnowledgeAsk', () => {
  beforeEach(() => {
    mockedMutate.mockReset();
  });

  it('disables Ask until there is a non-blank question and a resolved team', () => {
    render(<KnowledgeAsk team="product-1" />);
    const button = screen.getByRole('button', { name: 'Ask' });
    expect(button).toBeDisabled();
  });

  it('disables Ask entirely when no single team is resolved', () => {
    render(<KnowledgeAsk team={null} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('enables Ask once a question is typed', async () => {
    const user = userEvent.setup();
    render(<KnowledgeAsk team="product-1" />);
    await user.type(screen.getByRole('textbox'), 'what did we decide about retries?');
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('renders a resolvable citation as a link to the real console route', async () => {
    mockedMutate.mockResolvedValue({
      answer: 'The team decided to retry with backoff [1].',
      citations: [{ path: 'init-1/plan.md', title: 'The plan' }],
    });
    const user = userEvent.setup();
    render(<KnowledgeAsk team="product-1" />);
    await user.type(screen.getByRole('textbox'), 'what did we decide about retries?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    const link = await screen.findByRole('link', { name: 'The plan' });
    expect(link).toHaveAttribute('href', '/initiatives/product-1/init-1/plan.md');
    expect(mockedMutate).toHaveBeenCalledWith(
      '/ask?team=product-1',
      { question: 'what did we decide about retries?' },
    );
  });

  it('renders an unresolvable citation as plain text, never a broken link', async () => {
    mockedMutate.mockResolvedValue({
      answer: 'The platform learned this from a shared lesson [1].',
      citations: [{ path: null, title: 'A shared lesson' }],
    });
    const user = userEvent.setup();
    render(<KnowledgeAsk team="product-1" />);
    await user.type(screen.getByRole('textbox'), 'what has the platform learned?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await screen.findByText(/A shared lesson/);
    expect(screen.queryByRole('link', { name: /A shared lesson/ })).not.toBeInTheDocument();
  });

  it('shows the server\'s own sentence on failure, including a 503 naming a variable', async () => {
    // The variable name here is a stand-in, deliberately not `generate.ts`'s own
    // `LLM_API_KEY`/`LLM_BASE_URL` — scripts/gate.mjs's "the server-held LLM client stays
    // off the console" refuses any file under this repo that names either, on the theory
    // that a credential the browser can reach is a credential every visitor can reach (see
    // that check's own header). This test only needs to prove the server's exact sentence
    // reaches the screen unmodified, which naming a THIRD, unreserved variable does just as
    // well without tripping a check written for a different boundary than this test covers.
    const { ApiError } = await import('@/lib/api');
    mockedMutate.mockRejectedValue(
      new ApiError(503, 'the ask feature has no LLM endpoint configured — set PLATFORM_BASE_MODEL'),
    );
    const user = userEvent.setup();
    render(<KnowledgeAsk team="product-1" />);
    await user.type(screen.getByRole('textbox'), 'what did we decide?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => {
      expect(screen.getByText(/PLATFORM_BASE_MODEL/)).toBeInTheDocument();
    });
  });
});
