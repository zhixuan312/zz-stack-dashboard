import Image from 'next/image';
import { cn } from '@/lib/cn';
import { APP_NAME } from '@/nav';

/**
 * The product mark — the `Zz` wordmark from the ZZ brand kit.
 *
 * THIS IS NOW THE ONLY PLACE THE MARK IS DRAWN, which the previous version of this file
 * claimed in its docstring and was not. Only `Sidebar` imported it; `login`, `enrol` and
 * `signed-out` each hand-drew their own "ZZ" monogram, so the console showed a hexagon in
 * the rail and a lettermark on every auth screen — two marks and no decision between them.
 *
 * ONE OF THREE MARKS, and they are not interchangeable. This one is for 22-30px inside the
 * application, where it sits beside the product name and reads as identity. The flat
 * single-Z at `app/icon.png` is the tab icon, because two letters at 16px is mush. The
 * mascot squircle at `app/apple-icon.png` is the home-screen icon, where there is room for
 * the character. None is a scaled copy of another.
 *
 * The image is decorative — `alt=""` — because the accessible name comes from the
 * `APP_NAME` text beside it, or from the `sr-only` span when the wordmark is not shown.
 * Announcing it twice is worse than not announcing it at all.
 */
export function AppMark({
  withWordmark = false,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Image
        src="/assets/brand/wordmark.png"
        alt=""
        width={30}
        height={30}
        priority
        className="size-7 shrink-0 object-contain"
      />
      {withWordmark ? (
        <span className="text-sm font-semibold tracking-[-0.014em] text-ink">{APP_NAME}</span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </span>
  );
}
