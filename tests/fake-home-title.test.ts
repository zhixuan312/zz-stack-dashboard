// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { LAST_WEEK } from '../scripts/fake-gateway/work-initiatives.ts';

// The fake's Home says in its title what the same answer draws: a closure it names is one its tile counts.
describe("the fake's Home title", () => {
  it("for a team's first observed week names only the week's own figures", () => {
    const home = homeOf('beacon', 'ava.lindqvist@example.com');
    const closed = home.tiles.closed.figure.value!;
    const words = home.words.state === 'ok' ? home.words.data.weeks[LAST_WEEK].figure.value : null;
    expect(home.title.rule).toBe(1);
    expect(home.title.sentence.includes('closure')).toBe(closed > 0);
    expect(home.title.sentence.includes('words added')).toBe((words ?? 0) > 0);
  });
});
