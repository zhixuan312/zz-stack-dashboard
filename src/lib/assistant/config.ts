import { createHmac } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

type AssistantConfig = { model: LanguageModel; secret: string };

const SECRET_TEXT = 'meridian.assistant.approvals';

/**
 * Reads the `ASSISTANT_*` variables into a model and an approval secret.
 * Returns `null` when anything required is missing or the provider is unknown.
 * Server-only: the secret is derived from the API key.
 */
export function assistantConfig(env: Record<string, string | undefined>): AssistantConfig | null {
  const get = (name: string) => env[name]?.trim() || undefined;
  const provider = get('ASSISTANT_PROVIDER');
  const apiKey = get('ASSISTANT_API_KEY');
  const modelId = get('ASSISTANT_MODEL');
  const baseURL = get('ASSISTANT_BASE_URL');
  if (!apiKey || !modelId) return null;

  let model: LanguageModel;
  if (provider === 'anthropic') {
    model = createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId);
  } else if (provider === 'openai-compatible' && baseURL) {
    model = createOpenAICompatible({ name: 'assistant', apiKey, baseURL })(modelId);
  } else {
    return null;
  }
  return { model, secret: createHmac('sha256', apiKey).update(SECRET_TEXT).digest('base64url') };
}
