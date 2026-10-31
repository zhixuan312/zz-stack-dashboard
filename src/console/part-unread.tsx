import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/console/panel';

type Body = { reason: string; children?: never } | { reason?: never; children: ReactNode };

/**
 * A Platform page's card whose part of the read failed: the rest of the page stands, so the card says so quietly. The
 * reason goes in the standard sentence, or `children` says it where the page has more to add.
 */
export function PartUnavailable({ title, actions, ...body }: { title: string; actions?: ReactNode } & Body) {
  return (
    <Panel title={title} actions={actions}>
      <EmptyState layout="inline" title={`${title}: unavailable`}>
        {body.children ?? <>It could not be read ({body.reason}). The rest of the page stands.</>}
      </EmptyState>
    </Panel>
  );
}

/** A Work page's card whose part of the read failed: what did not load, and the gateway's reason. */
export const PartUnread = ({ title, reason, actions }: { title: string; reason: string; actions?: ReactNode }) => (
  <Panel title={title} actions={actions}><EmptyState kind="error" title={`${title} did not load`} className="py-8">{reason}</EmptyState></Panel>
);
