import Image from 'next/image';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Heading, TextSm } from '@/components/ui/typography';

/**
 * EmptyState — the "nothing here yet" placeholder. A `Heading`, a line of supporting
 * `TextSm`, an optional action, and either a mascot illustration or a lucide icon in a
 * tinted circle.
 *
 * DELIBERATE: `icon` stays required even though `illustration` usually supersedes it. It is
 * the fallback that keeps a failed image from leaving the state with no picture; optional, it
 * would allow a state with neither.
 */
interface EmptyStateProps {
  icon: ReactNode;
  /** Mascot artwork. When present it replaces the icon badge entirely. */
  illustration?: { src: string; width: number; height: number };
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className,
      )}
    >
      {illustration ? (
        <Image
          src={illustration.src}
          alt=""
          width={illustration.width}
          height={illustration.height}
          className="mb-1 h-24 w-auto object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-deep [&_svg]:size-6"
        >
          {icon}
        </span>
      )}
      <Heading className="!text-base">{title}</Heading>
      {description ? <TextSm className="max-w-sm">{description}</TextSm> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
