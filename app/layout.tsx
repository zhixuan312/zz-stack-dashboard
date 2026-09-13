import type { Metadata } from 'next';
import { Rubik, Baloo_2, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { APP_NAME } from '@/nav';

/**
 * THREE families, and the third is confined on purpose.
 *
 * There was a serif here, carrying every heading and every metric value. It is
 * the fastest way to make a product interface look like a publication: a serif
 * headline reads as editorial voice, and a dashboard has no voice — it has a
 * hierarchy. That hierarchy now comes from weight, size and tracking, which is
 * how the interfaces this is modelled on do it.
 *
 * Rubik replaced Inter when the ZZ brand arrived. It has rounded terminals on every
 * glyph, which is what the kit's register asks for, and — the part that actually decided
 * it — a REAL `tnum` feature, verified by reading the shipped Google Fonts binary rather
 * than a feature listing. That matters because 44 call sites use `tabular-nums`; a face
 * without it drops the declaration silently, with no error, and every numeric column
 * frays. Poppins, which the kit names, has no tabular figures at all.
 *
 * Baloo 2 carries `.t-stat` and `.t-display` ONLY — the one big number on a page and its
 * title. It is where the brand's warmth gets to appear on the element every page is built
 * around. It is confined because its own foundry calls it a display typeface, and it is
 * safe there because it too carries `tnum`, so the stat still aligns.
 *
 * Mono is reserved for identifiers and code — NOT for labels, which is where it had
 * spread to.
 */
const sans = Rubik({
  variable: '--font-sans-family',
  subsets: ['latin'],
  display: 'swap',
  // Three weights. Four is the ceiling and three is usually enough: regular for
  // prose, medium for labels and controls, semibold for headings and stats.
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
  // NO `icons` KEY, DELIBERATELY. The tab icon and the apple-touch icon are served by Next's
  // app/ file convention from app/icon.png and app/apple-icon.png. Declaring `icons` here does
  // not duplicate that — it SUPPRESSES it: resolve-metadata.js merges file-convention icons
  // only `if (!resolvedMetadata.icons)`, so an explicit declaration silently drops every icon
  // file. It was invisible before only because both paths pointed at the same file.
  description: 'Every team, flow, skill and initiative on the ZZ platform, and how far each got.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // `h-full` on both html and body: the shell is `fixed inset-0` and the
      // document itself never scrolls (see the ROOT LOCK block in globals.css).
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
