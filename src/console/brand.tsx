'use client';

import { preload } from 'react-dom';
import type { ReactNode } from 'react';
import { EmptyStateArt } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

/**
 * ZZ's brand layer over Meridian: the mascot, in the moments a page has no data to lead with. docs/brand.md is the
 * rule; this file is the one place the poses are chosen, so a state never borrows another state's face.
 *
 * Each pose is built from its master in design/in-use by scripts/build-brand-assets.py, as WebP at the size drawn here
 * and at twice it.
 */
const POSES = {
  /** Nothing here yet: a first run, a list nobody has filled. */
  empty: { stem: 'state-empty', w: 96, h: 96 },
  /** Something failed to load or render. */
  error: { stem: 'state-error', w: 73, h: 96 },
  /** No such page, record or match. */
  notfound: { stem: 'state-notfound', w: 75, h: 96 },
  /** Hello: enrolment, and the first thing to add. */
  welcome: { stem: 'state-welcome', w: 76, h: 96 },
  /** The session ended. */
  goodbye: { stem: 'state-goodbye', w: 103, h: 128 },
  /** A gate was approved: the platform's signature act. */
  approved: { stem: 'state-approved', w: 33, h: 40 },
} as const;

export type Pose = keyof typeof POSES;

/** A pose's two files as the browser chooses between them: by the width it will be drawn at and the screen's density. */
function sources(pose: Pose, scale = 1) {
  const p = POSES[pose];
  const src = `/assets/brand/${p.stem}.webp`;
  return { src, srcSet: `${src} ${p.w}w, /assets/brand/${p.stem}-2x.webp ${p.w * 2}w`, sizes: `${Math.round(p.w * scale)}px` };
}

/** One pose of the mascot on a soft accent halo. Decorative: the words beside it carry the meaning. */
export function Mascot({ pose, scale = 1, className }: { pose: Pose; scale?: number; className?: string }) {
  const p = POSES[pose];
  return (
    <span aria-hidden className={cn('relative grid place-items-center', className)}>
      <span className="absolute rounded-full bg-accent-tint" style={{ width: p.h * scale * 1.25, height: p.h * scale * 1.25 }} />
      {/* A plain `<img>`, as Meridian draws its own pictures: the brand layer is in every page's first load, and
          `next/image` cost each of them 12 kB of script to resize six files the asset script sizes once. Never lazy: an
          empty state's mascot is usually the largest thing on the page, and lazy loading it delays the paint. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- six local files at two fixed sizes each, built by scripts/build-brand-assets.py; next/image adds nothing for them. */}
      <img {...sources(pose, scale)} alt="" width={Math.round(p.w * scale)} height={Math.round(p.h * scale)} className="relative object-contain" />
    </span>
  );
}

/** Every centred empty state gets the mascot for its kind: first run, filtered to nothing, failed. */
export function BrandArt({ children }: { children: ReactNode }) {
  // The first-run pose is often the largest paint of an empty page, and it can only start loading once the page knows
  // it is empty. A hint in the HTML, with the same two files the `<img>` will choose from, has it ready by then. Only
  // this one: the other poses are rarer than the bytes they would cost every page.
  const empty = sources('empty');
  preload(empty.src, { as: 'image', imageSrcSet: empty.srcSet, imageSizes: empty.sizes, fetchPriority: 'low' });
  return (
    <EmptyStateArt value={{ 'first-run': <Mascot pose="empty" />, filtered: <Mascot pose="notfound" />, error: <Mascot pose="error" /> }}>
      {children}
    </EmptyStateArt>
  );
}
