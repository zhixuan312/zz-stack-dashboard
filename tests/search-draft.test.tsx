import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchDraft } from '@/components/patterns/data-table';

// Where the address is the state, each write is a navigation: a search that wrote on every key asked the server once
// a character. The box shows what is typed at once and the address is written when the typing stops (issue #24).
describe('a search kept in the address', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows each character at once and writes once, after the typing stops', () => {
    const write = vi.fn();
    const { result } = renderHook(() => useSearchDraft('', write));
    for (const text of ['e', 'eu', 'eu-']) act(() => { result.current[1](text); });
    expect(result.current[0]).toBe('eu-');
    expect(write).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(write.mock.calls).toEqual([['eu-']]);
  });

  it('writes a cleared search at once: Escape and Clear are an answer, not typing', () => {
    const write = vi.fn();
    const { result } = renderHook(() => useSearchDraft('eu-west', write));
    act(() => { result.current[1](''); });
    act(() => { vi.advanceTimersByTime(0); });
    expect(write.mock.calls).toEqual([['']]);
  });

  it('follows the address when something else changes it', () => {
    const write = vi.fn();
    const { result, rerender } = renderHook(({ applied }) => useSearchDraft(applied, write), { initialProps: { applied: 'eu' } });
    rerender({ applied: '' });
    expect(result.current[0]).toBe('');
    act(() => { vi.advanceTimersByTime(300); });
    expect(write).not.toHaveBeenCalled();
  });
});
