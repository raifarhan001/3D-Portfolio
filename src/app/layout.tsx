import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { WELCOME_CONFIG } from '@/config/welcomeConfig';
import { getWelcomeGitHubSummary } from '@/utils/githubProjects';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const summary = getWelcomeGitHubSummary();

export const viewport: Viewport = {
  themeColor: WELCOME_CONFIG.cinema.palette.ink,
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(WELCOME_CONFIG.siteUrl),
  title: WELCOME_CONFIG.seo.title,
  description: summary.profileTagline || WELCOME_CONFIG.tagline,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: WELCOME_CONFIG.seo.title,
    description: summary.profileTagline || WELCOME_CONFIG.tagline,
    url: WELCOME_CONFIG.siteUrl,
    siteName: summary.displayName,
    type: 'website',
    images: [
      {
        url: WELCOME_CONFIG.seo.ogImageUrl,
        width: WELCOME_CONFIG.seo.ogWidth,
        height: WELCOME_CONFIG.seo.ogHeight,
        alt: WELCOME_CONFIG.seo.ogAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: WELCOME_CONFIG.seo.title,
    description: summary.profileTagline || WELCOME_CONFIG.tagline,
    images: [WELCOME_CONFIG.seo.ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Intercept external chrome extension message timeouts cleanly before Next.js dev overlay */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function shouldSuppress(str) {
                  return str && (
                    str.indexOf('chrome-extension://') !== -1 ||
                    str.indexOf('chrome: call method') !== -1 ||
                    str.indexOf('crxemulator') !== -1
                  );
                }
                window.addEventListener('unhandledrejection', function(e) {
                  var r = e.reason;
                  var msg = (r && (r.stack || r.message || r.toString())) || '';
                  if (shouldSuppress(msg)) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);
                window.addEventListener('error', function(e) {
                  var msg = (e.message || '') + ' ' + (e.filename || '');
                  if (shouldSuppress(msg)) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body
        className="font-sans bg-[#07080B] text-[#F2EDE4] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
