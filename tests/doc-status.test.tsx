import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DocStatus } from '@/console/doc-status';

/** A closing document corrected after the close is waiting on a person again, and says which
 *  version is waiting: "Awaiting approval" beside "Outcome: accepted" reads as a close recorded
 *  on an unapproved document. */
describe('DocStatus', () => {
  it('names a correction awaiting approval by its version', () => {
    render(<DocStatus status="draft" outcome="accepted" gated correction={2} />);
    expect(screen.getByText('Correction v2 awaiting approval')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument();
  });

  it('keeps an approved document approved', () => {
    render(<DocStatus status="approved" outcome="accepted" gated correction={null} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});
