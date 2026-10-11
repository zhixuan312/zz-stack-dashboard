/**
 * The fake gateway's live stream, as `references/live.md` specifies it.
 *
 * What is asserted here is the contract the console consumes and the refusals a caller can drive, not the framing
 * details: the names a tab may follow, one body for an unknown name and a forbidden one, a resync first, a hint that
 * names a collection and nothing else, and frames only to the tabs that follow it.
 */
import type { ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS, MAX_NAMES, hint, liveStreams, parseNames, serveLive } from '../scripts/fake-gateway/live.ts';

/** The least a stream writes to: enough to record the frames and to fire the close handler `serveLive` listens for. */
function stubRes() {
  const frames: string[] = [];
  let onClose: (() => void) | undefined;
  const res = {
    frames,
    writeHead: () => res,
    flushHeaders: () => {},
    write: (frame: string) => { frames.push(frame); return true; },
    end: () => {},
    on: (event: string, handler: () => void) => { if (event === 'close') onClose = handler; return res; },
    away: () => onClose?.(),
  };
  return res as unknown as ServerResponse & { frames: string[]; away: () => void };
}

const events = (frames: string[]) => frames.join('').split('\n').filter((l) => l.startsWith('event: '));

describe('the names a tab may follow', () => {
  it('accepts the console\'s own collections', () => {
    expect(parseNames('teams,initiatives')).toEqual({ names: ['teams', 'initiatives'] });
  });

  it('takes the same name twice as one subscription', () => {
    expect(parseNames('teams,teams')).toEqual({ names: ['teams'] });
  });

  it('refuses an empty or malformed list with 400', () => {
    for (const raw of [null, '', 'teams,', 'teams,,initiatives', 'not a name', 'a'.repeat(65)]) {
      expect(parseNames(raw), String(raw)).toEqual({ status: 400, error: 'Name the collections to follow.' });
    }
  });

  it('refuses more than the bound with 400', () => {
    const many = Array.from({ length: MAX_NAMES + 1 }, (_, i) => `c${i}`).join(',');
    expect(parseNames(many)).toEqual({ status: 400, error: 'Name the collections to follow.' });
  });

  it('answers an unknown name and a forbidden one alike, so neither is disclosed', () => {
    expect(parseNames('bogus')).toEqual({ status: 403, error: 'You do not have access to that.' });
    // A real collection the caller may not read is refused with the same sentence and the same status.
    expect(parseNames('bogus,teams')).toEqual(parseNames('bogus'));
  });

  it('names the console\'s reads, which is what the pages register', () => {
    for (const name of ['me', 'teams', 'initiatives', 'document', 'knowledge', 'plugins', 'skills', 'people', 'runs', 'activity', 'settings', 'overview']) {
      expect(COLLECTIONS, name).toContain(name);
    }
  });
});

describe('a stream', () => {
  it('resynchronises before anything else, and says it does not replay', () => {
    const res = stubRes();
    serveLive(res, ['initiatives']);
    const text = res.frames.join('');
    expect(text).toContain('retry: 3000');
    expect(events(res.frames)).toEqual(['event: resync']);
    expect(text).toContain('data: {"collections":["initiatives"]}');
    expect(text).not.toContain('id:');           // an `id:` would claim a replay the stream cannot make
    res.away();
  });

  it('hints a collection by name and nothing else', () => {
    const res = stubRes();
    serveLive(res, ['initiatives']);
    expect(hint('initiatives')).toBe(1);
    const change = res.frames.find((f) => f.startsWith('event: change'));
    expect(change).toBe('event: change\ndata: {"collection":"initiatives"}\n\n');
    // No record, no team and no cache tag leaves the server: the frame is the collection's name and nothing else.
    expect(change).not.toMatch(/initiative\/|team|tag|\d{4}-\d{2}-\d{2}/);
    res.away();
  });

  it('reaches only the tabs that follow it', () => {
    const follows = stubRes();
    const other = stubRes();
    serveLive(follows, ['initiatives']);
    serveLive(other, ['teams']);
    expect(liveStreams()).toBe(2);
    expect(hint('initiatives')).toBe(1);
    expect(events(follows.frames)).toEqual(['event: resync', 'event: change']);
    expect(events(other.frames)).toEqual(['event: resync']);
    follows.away();
    other.away();
  });

  it('drops a hint for a collection nobody follows', () => {
    const res = stubRes();
    serveLive(res, ['teams']);
    expect(hint('runs')).toBe(0);
    expect(events(res.frames)).toEqual(['event: resync']);
    res.away();
  });

  it('lets go of a tab that went away', () => {
    const res = stubRes();
    serveLive(res, ['teams']);
    expect(liveStreams()).toBe(1);
    res.away();
    expect(liveStreams()).toBe(0);
    expect(hint('teams')).toBe(0);
  });
});
