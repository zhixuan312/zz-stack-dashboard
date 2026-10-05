import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchInput } from '@/components/ui/search-input';

/**
 * The search box sends what was typed when the typing stops, not per keystroke.
 *
 * The address IS the state, so each keystroke used to write it: eight characters meant eight
 * `router.replace` calls and eight re-renders of every row in the table behind the box. The test is
 * on the CONTROL, because that is where the delay belongs — the write itself has to stay immediate
 * for a filter click, which is the same hook.
 *
 * The other half is the controlled-input contract, and it is the half that breaks quietly: the field
 * keeps its own text, so it has to adopt a value that arrives from anywhere else (a filtered link,
 * Clear filters, the back button) WITHOUT treating the echo of its own write as one of those. A
 * version that adopted everything would erase what somebody was typing the moment the table
 * answered.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const box = () => screen.getByRole('searchbox') as HTMLInputElement;

describe('SearchInput', () => {
  it('sends once, after the typing stops, and sends what was typed', () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="" onValueChange={onValueChange} />);

    for (const text of ['i', 'in', 'ini', 'init', 'initi']) {
      fireEvent.change(box(), { target: { value: text } });
      vi.advanceTimersByTime(20);            // faster than a person types, so the timer never fires
    }
    expect(onValueChange).not.toHaveBeenCalled();
    expect(box().value).toBe('initi');       // and the box still shows every character

    vi.advanceTimersByTime(200);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('initi');
  });

  it('adopts a value that came from somewhere else', () => {
    const { rerender } = render(<SearchInput value="" onValueChange={() => {}} />);
    rerender(<SearchInput value="from the link" onValueChange={() => {}} />);
    expect(box().value).toBe('from the link');
  });

  it('does not erase typing when its own write comes back as the value', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onValueChange={onValueChange} />);
    fireEvent.change(box(), { target: { value: 'abc' } });
    vi.advanceTimersByTime(200);
    expect(onValueChange).toHaveBeenCalledWith('abc');

    // The page answered by handing the same text back, as the address does. Then the reader keeps
    // typing: a component that adopted the echo would have thrown this character away.
    rerender(<SearchInput value="abc" onValueChange={onValueChange} />);
    fireEvent.change(box(), { target: { value: 'abcd' } });
    expect(box().value).toBe('abcd');
  });

  it('clears at once, because somebody who pressed Escape is not still typing', () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="typed" onValueChange={onValueChange} />);
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(onValueChange).toHaveBeenCalledWith('');
    expect(box().value).toBe('');

    onValueChange.mockClear();
    fireEvent.change(box(), { target: { value: 'again' } });
    vi.advanceTimersByTime(200);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });
});
