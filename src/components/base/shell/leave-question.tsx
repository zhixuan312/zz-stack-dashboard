'use client';

import { Button } from '../../ui/button/index';
import { Dialog, DialogContent } from '../../ui/dialog/index';

/**
 * The question the shell asks before a person leaves unsaved changes. It is a file of its own so the shell can load it
 * only when something on the page is unsaved (see `useLeaveGuard` in ./index.tsx): the dialog and its buttons are code a
 * page that never asks should not download.
 */
export function LeaveQuestion({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onStay(); }}>
      <DialogContent
        size="sm"
        title="Leave without saving?"
        description="This page has a local draft. Stay to review it, or leave without confirming it. Leaving does not undo a request already sent."
        footer={
          <>
            <Button variant="ghost" onClick={onStay}>Stay</Button>
            <Button variant="danger" onClick={onLeave}>Leave</Button>
          </>
        }
      />
    </Dialog>
  );
}
