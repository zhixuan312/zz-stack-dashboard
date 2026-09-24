import type { Metadata } from 'next';
import { Rubik, Baloo_2, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { APP_NAME } from '@/nav';

/**
 * Three families, and the third is confined on purpose.
 *
 * Hierarchy comes from weight, size and tracking, never from a serif.
 *
 * DELIBERATE: any replacement for Rubik must carry a real `tnum` feature, verified in the
 * shipped font binary rather than a feature listing. Numeric columns use `tabular-nums`, and a
 * face without it drops the declaration silently and frays every numeric column. Poppins,
 * which the brand kit names, has no tabular figures at all.
 *
 * Baloo 2 carries `.t-stat` and `.t-display` only — the one big number on a page and its
 * title. Confined because its foundry calls it a display typeface, and safe there because it
 * carries `tnum` too.
 *
 * Mono is reserved for identifiers and code, never for labels.
 */
const sans = Rubik({
  variable: '--font-sans-family',
  subsets: ['latin'],
  display: 'swap',
  // Three weights, four is the ceiling: regular for prose, medium for labels and controls,
  // semibold for headings and stats.
  weight: ['400', '500', '600'],
});

// One weight. Display type has one job here and does not need a range.
const display = Baloo_2({
  variable: '--font-display-family',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono-family',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: APP_NAME,
  // DELIBERATE: no `icons` key. The tab icon and the apple-touch icon are served by Next's
  // app/ file convention from app/icon.png and app/apple-icon.png, and resolve-metadata.js
  // merges those only `if (!resolvedMetadata.icons)` — so declaring `icons` here suppresses
  // every icon file rather than adding to them.
  description: 'Every team, flow, skill and initiative on the ZZ platform, and how far each got.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // COUPLED: `h-full` on both html and body. The shell is `fixed inset-0` and the
      // document never scrolls — see the root lock block in globals.css.
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
