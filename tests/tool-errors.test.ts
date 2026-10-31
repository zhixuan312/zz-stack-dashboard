import { describe, expect, it } from 'vitest';
import { Unasked } from '@/data/prepared-aggregate';
import { toolFailure } from '@/lib/assistant/tool-errors';
import { PREPARED } from '@/data/prepared';

// A read the console refuses itself, before asking anything, is a question to ask differently, not an outage: the model
// is told the console's own sentence, which names what the measure does answer.
describe('what the model is told when a tool throws', () => {
  it('a drill of a measure that lists no rows: the sentence naming the page that counts it', () => {
    const calls = PREPARED.find((r) => r.name === 'skill_calls')!;
    const sentence = (calls.drill as { none: string }).none;
    expect(String(toolFailure(new Unasked(sentence)))).toBe(sentence);
  });

  it('anything else it did not write: one fixed sentence, never the error\'s own words', () => {
    expect(String(toolFailure(new Error('connect ECONNREFUSED 10.0.0.12:5432')))).toMatch(/^The platform could not answer that read just now\./);
  });
});
