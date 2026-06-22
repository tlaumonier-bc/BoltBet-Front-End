// the shared site config so the brand/URL live in one place.
import type { Metadata } from 'next';
import { Unbounded, Sora } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav/Nav';
import Toaster from '@/components/Toaster/Toaster';
import { site } from '@/lib/content/content';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  weight: ['600', '700', '800'],
});
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['300', '400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.baseUrl),
  title: {
    template: `%s | ${site.brand}`,
    default: `${site.brand} — Live Lightning Map & 60-Second Game`,
  },
  description:
    'Watch real-time lightning strikes worldwide on a live map, then guess whether more or fewer bolts hit in the next 60 seconds. Free to play, no real money.',
  keywords: [
    'lightning map', 'lightning map live', 'lightning tracker', 'lightning strike map',
    'real-time lightning', 'storm tracker', 'blitzortung', 'weather game online',
  ],
  openGraph: {
    type: 'website',
    siteName: site.brand,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: site.brand,
  applicationCategory: 'GameApplication',
  description: 'Real-time lightning map with a 60-second prediction game',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Real-time lightning map',
    'Live 3D globe',
    'Localized lightning maps',
    '60-second prediction game',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${sora.variable}`}>
      <head>
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="dns-prefetch" href="https://unpkg.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="antialiased">
        <Nav />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
