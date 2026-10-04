import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

/**
 * One titled card on a console page: the unit every chart, list and table sits in. A thin composition over Meridian's
 * `Card` that fixes the head (title, a line under it, controls on the right) and the body. `flush` when the child is
 * a table or list that runs edge to edge.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
  ...rest
}: {
  title: ReactNode;
  /** One quiet line under the title: what the card counts, or over what. */
  description?: ReactNode;
  /** On the right of the head: a count, a link, a filter. */
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'>) {
  return (
    <Card className={className} {...rest}>
      <CardHeader title={title} description={description} actions={actions} divided={flush} />
      <CardBody flush={flush}>{children}</CardBody>
    </Card>
  );
}
