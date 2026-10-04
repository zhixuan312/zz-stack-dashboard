import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProseBlock } from '@/console-old/patterns/prose-block';

describe('ProseBlock', () => {
  it('names a task-list box by its state', () => {
    // remark-gfm renders `- [ ]` as a bare disabled checkbox; a spec's acceptance list put 38
    // unnamed controls on one page.
    render(<ProseBlock>{'- [x] shipped\n- [ ] verified'}</ProseBlock>);
    expect(screen.getByRole('checkbox', { name: 'done' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'not done' })).not.toBeChecked();
  });
});
