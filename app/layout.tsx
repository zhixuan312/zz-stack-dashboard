import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { app } from '@/app.config';
import { PREPAINT } from '@/lib/preferences';
import { Providers } from '@/components/base/providers';
import { ConsoleProviders } from '@/console/providers';
import './globals.css';

/* The faces are self-hosted by next/font and handed to the tokens as --font-face-sans and --font-face-mono.
 *
 * COUPLED: the `display` and `fallback` of both faces. `next/font` generates its metric fallback from
 * `local("Arial")` alone, so on a machine without Arial — every Linux server, and the runner's own Chrome — that
 * face errors, and without `fallback` the page falls through to the browser's initial font, a SERIF, until the real
 * face arrives. The whole page then reflows from serif to sans, which is a layout shift of 0.117 on the standalone
 * screens, whose content is centred and so moves by half of whatever the text re-wraps. `optional` is what stops
 * that: a face that has not arrived within its block period is not swapped in later on that page load, so there is
 * no re-wrap to shift anything. `fallback` is what makes that bearable, by naming real sans faces for the cold load
 * rather than leaving it to the initial font. Both are checked by `scripts/check.local.ts`. */
const sans = Geist({ subsets: ['latin'], variable: '--font-face-sans', display: 'optional', fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Liberation Sans', 'sans-serif'] });
// Mono sets only small labels and identifiers, so it is not preloaded: on a slow phone it would contend with the
// page's own script for the first second of bandwidth.
const mono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-face-mono', display: 'optional', preload: false, fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'] });

export const metadata: Metadata = {
  title: { default: app.name, template: `%s · ${app.name}` },
  description: 'Every team, flow, skill and initiative on the ZZ platform, and how far each got.',
};

/* The browser chrome's colour is a meta tag, which cannot read a CSS variable: these are the two grounds, by hand. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF0F8' }, // allow-literal-colour: ground, light
    { media: '(prefers-color-scheme: dark)', color: '#0A0B10' }, // allow-literal-colour: ground, dark
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-accent={app.accent} className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        <Providers>
          <ConsoleProviders>{children}</ConsoleProviders>
        </Providers>
      </body>
    </html>
  );
}
