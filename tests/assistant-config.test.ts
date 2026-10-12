// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { assistantConfig } from '@/lib/assistant/config';

const REPLY = {
  anthropic: { id: 'msg_1', type: 'message', role: 'assistant', model: 'm', stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', id: 'tu_1', name: 'probe', input: { ids: ['m3'] } }] },
  'openai-compatible': { id: 'c1', object: 'chat.completion', created: 1, model: 'm', usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'tc_1', type: 'function', function: { name: 'probe', arguments: '{"ids":["m3"]}' } }] } }] },
} as const;

const ENV = {
  anthropic: { ASSISTANT_PROVIDER: 'anthropic', ASSISTANT_API_KEY: 'sk-ant-test', ASSISTANT_MODEL: 'claude-sonnet-5-5' },
  'openai-compatible': { ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'sk-or-test', ASSISTANT_MODEL: 'qwen-max', ASSISTANT_BASE_URL: 'https://llm.example/v1' },
} as const;

afterEach(() => vi.unstubAllGlobals());

describe('assistantConfig', () => {
  test('is null when a required variable is missing or the provider is unknown', () => {
    expect(assistantConfig({})).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: 'anthropic', ASSISTANT_API_KEY: 'k' })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: 'anthropic', ASSISTANT_MODEL: 'm' })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm' })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: 'gemini', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm', ASSISTANT_BASE_URL: 'https://x.example' })).toBeNull();
  });

  test.each(['anthropic', 'openai-compatible'] as const)('%s builds a model that sends the tools and parses a tool call', async (provider) => {
    const seen: { url?: string; model?: string; tools?: string[]; auth?: string } = {};
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const headers = new Headers(init.headers);
      Object.assign(seen, { url: String(url), model: body.model, tools: (body.tools ?? []).map((t: any) => t.name ?? t.function?.name), auth: headers.get('x-api-key') ?? headers.get('authorization') ?? undefined });
      return new Response(JSON.stringify(REPLY[provider]), { headers: { 'content-type': 'application/json' } });
    });
    const config = assistantConfig(ENV[provider]);
    expect(config).not.toBeNull();
    const r = await generateText({ model: config!.model, tools: { probe: tool({ inputSchema: z.object({ ids: z.array(z.string()) }) }) }, prompt: 'probe m3' });
    expect(seen.model).toBe(ENV[provider].ASSISTANT_MODEL);
    expect(seen.tools).toEqual(['probe']);
    expect(seen.auth).toContain(ENV[provider].ASSISTANT_API_KEY);
    if (provider === 'openai-compatible') expect(seen.url).toBe('https://llm.example/v1/chat/completions');
    expect(r.toolCalls.map((c) => c.toolName)).toEqual(['probe']);
  });

  test('the approval secret comes from the key: stable, at least 32 characters, never the key itself', () => {
    const a = assistantConfig(ENV.anthropic)!.secret;
    expect(a).toBe(assistantConfig(ENV.anthropic)!.secret);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toContain(ENV.anthropic.ASSISTANT_API_KEY);
    expect(a).not.toBe(assistantConfig({ ...ENV.anthropic, ASSISTANT_API_KEY: 'another-key' })!.secret);
  });
});
