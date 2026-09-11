import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { APP_NAME } from '@/nav';

/**
 * TWO families, not three.
 *
 * There was a serif here, carrying every heading and every metric value. It is
 * the fastest way to make a product interface look like a publication: a serif
 * headline reads as editorial voice, and a dashboard has no voice — it has a
 * hierarchy. That hierarchy now comes from weight, size and tracking, which is
 * how the interfaces this is modelled on do it.
 *
 * Inter is the default for a reason: it was drawn for screen UI at small sizes,
 * its figures are properly tabular, and it has the optical sizing that keeps a
 * 40px number and an 11px label looking like the same typeface rather than the
 * same file scaled twice. Mono is reserved for identifiers and code — NOT for
 * labels, which is where it had spread to.
 */
const sans = Inter({
  variable: '--font-sans-family',
  subsets: ['latin'],
  display: 'swap',
  // Three weights. Four is the ceiling and three is usually enough: regular for
  // prose, medium for labels and controls, semibold for headings and stats.
  weight: ['400', '500', '600'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono-family',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: APP_NAME,
  // The tab icon lives at app/icon.svg — Next serves it and links it from the head, so there
  // is no <link> to keep in step. Declared here as well because a description and an icon are
  // the two things a browser and a shared link both read, and the console had neither.
  description: 'Every team, flow, skill and initiative on the ZZ platform, and how far each got.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // `h-full` on both html and body: the shell is `fixed inset-0` and the
      // document itself never scrolls (see the ROOT LOCK block in globals.css).
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Applies the stored theme BEFORE first paint.

          Without this, the document paints with the default palette and then
          corrects itself the moment React hydrates — a white flash on every
          load for anyone using dark. It has to be inline and blocking (no
          `defer`, no component) because anything asynchronous is by definition
          after the first paint it exists to prevent.

          Wrapped in try/catch: localStorage throws in a partitioned iframe and
          under some privacy settings, and a theme preference is not worth a
          blank page.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
