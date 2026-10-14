'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { HeartPulse, RotateCw } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDay } from '@/lib/format-date';
import { DEFINITION, LABEL, asOfLine, formatRate, platformStatusContext, tileOf, troubleOf, type StatusRead } from '@/views/platform-status-context';

/**
 * The platform's Status, as far as it is built: one tile, malformed calls per 1,000 real-work calls in the last whole
 * week, read on the console's server and handed here. A read that failed, that answered without the measure, or that
 * took longer than its bound is the template's error state with Retry, which asks the server again.
 */
export function PlatformStatusView({ read }: { read: StatusRead }) {
  useShareView(platformStatusContext(read));
  if (read.state !== 'ok') return <StatusTrouble state={read.state} />;
  const tile = tileOf(read.last);
  return (
    <Row split="tiles">
      <MetricTile
        label={LABEL}
        hint={DEFINITION}
        icon={<HeartPulse />}
        value={tile.value}
        format={formatRate}
        note={tile.note}
        finding={tile.finding ? { text: tile.finding } : undefined}
      />
    </Row>
  );
}

/**
 * The masthead's as-of line, the read's own cutoff, and Ask about the tile's week: nothing when there is no read to
 * date. Ask is here because the tile, a `MetricTile`, has no head to hold it.
 */
export function PlatformStatusAsOf({ read }: { read: StatusRead }) {
  if (read.state !== 'ok') return null;
  const question = read.last
    ? `What do malformed calls per 1,000 in the week of ${formatDay(read.last.window.from)} say about how real work calls tools?`
    : 'Why is there no whole week of malformed calls per 1,000 to read yet?';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="t-small text-ink-3">{asOfLine(read.meta)}</span>
      <AskAbout iconBelowSm question={question} />
    </span>
  );
}

function StatusTrouble({ state }: { state: Exclude<StatusRead['state'], 'ok'> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = troubleOf(state);
  return (
    <Card>
      <EmptyState
        kind="error"
        title={title}
        className="py-16"
        action={<Button variant="primary" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}
      >
        {detail}
      </EmptyState>
    </Card>
  );
}
