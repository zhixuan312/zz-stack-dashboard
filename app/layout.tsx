import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { app } from '@/app.config';
import { PREPAINT } from '@/lib/preferences';
import { Providers } from '@/components/base/providers';
import { ConsoleProviders } from '@/console/providers';
import './globals.css';

/* The faces are self-hosted by next/font and handed to the tokens as --font-face-sans and --font-face-mono. */
const sans = Geist({ subsets: ['latin'], variable: '--font-face-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-face-mono', display: 'swap' });

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
