import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* tailwind-merge learns Meridian's scales, so `text-sm` and `text-ink-2` are two groups, not one class overriding the other. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', 'page', 'hero', 'display'],
      radius: ['xs', 'sm', 'md', 'lg', 'xl', 'full'],
      shadow: ['card', 'raise', 'overlay', 'control', 'accent', 'feature'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
