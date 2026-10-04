'use client';

import Image, { getImageProps } from 'next/image';
import { preload } from 'react-dom';
import type { ReactNode } from 'react';
import { EmptyStateArt } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

/**
 * ZZ's brand layer over Meridian: the mascot, in the moments a page has no data to lead with. docs/brand.md is the
 * rule; this file is the one place the poses are chosen, so a state never borrows another state's face.
 *
 * Each pose is built from its master in design/in-use by scripts/build-brand-assets.py, at twice the size drawn here.
 */
const POSES = {
  /** Nothing here yet: a first run, a list nobody has filled. */
  empty: { src: '/assets/brand/state-empty.png', w: 96, h: 96 },
  /** Something failed to load or render. */
  error: { src: '/assets/brand/state-error.png', w: 73, h: 96 },
  /** No such page, record or match. */
  notfound: { src: '/assets/brand/state-notfound.png', w: 76, h: 96 },
  /** Hello: enrolment, and the first thing to add. */
  welcome: { src: '/assets/brand/state-welcome.png', w: 78, h: 96 },
  /** The session ended. */
  goodbye: { src: '/assets/brand/state-goodbye.png', w: 102, h: 128 },
  /** A question is being answered. */
  thinking: { src: '/assets/brand/state-thinking.png', w: 58, h: 72 },
  /** A gate was approved: the platform's signature act. */
  approved: { src: '/assets/brand/state-approved.png', w: 32, h: 40 },
} as const;

export type Pose = keyof typeof POSES;

/** One pose of the mascot on a soft accent halo. Decorative: the words beside it carry the meaning. */
export function Mascot({ pose, scale = 1, className }: { pose: Pose; scale?: number; className?: string }) {
  const p = POSES[pose];
  return (
    <span aria-hidden className={cn('relative grid place-items-center', className)}>
      <span className="absolute rounded-full bg-accent-tint" style={{ width: p.h * scale * 1.25, height: p.h * scale * 1.25 }} />
      {/* Eager: an empty state's mascot is usually the largest thing on the page, so lazy loading it delays the paint. */}
      <Image src={p.src} alt="" width={p.w * scale} height={p.h * scale} loading="eager" className="relative object-contain" />
    </span>
  );
}

/** Every centred empty state gets the mascot for its kind: first run, filtered to nothing, failed. */
export function BrandArt({ children }: { children: ReactNode }) {
  // The first-run pose is often the largest paint of an empty page, and it can only start loading once the page knows
  // it is empty. A hint in the HTML, with the srcset next/image will choose from, has it ready by then. Only this one:
  // the other poses are rarer than the bytes they would cost every page.
  const empty = getImageProps({ src: POSES.empty.src, width: POSES.empty.w, height: POSES.empty.h, alt: '' }).props;
  preload(empty.src, { as: 'image', imageSrcSet: empty.srcSet, fetchPriority: 'low' });
  return (
    <EmptyStateArt value={{ 'first-run': <Mascot pose="empty" />, filtered: <Mascot pose="notfound" />, error: <Mascot pose="error" /> }}>
      {children}
    </EmptyStateArt>
  );
}
