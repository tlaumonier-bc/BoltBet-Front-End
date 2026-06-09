import type { Metadata } from 'next'
import { Unbounded, Sora } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav/Nav'
import Toaster from '@/components/Toaster/Toaster'
import BetModal from '@/components/BetModal/BetModal'

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  weight: ['600', '700', '800'],
})
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://boltbet.com'),
  title: {
    template: '%s | BoltBet — Real-Time Lightning Prediction Game',
    default: 'BoltBet — Predict Lightning Strikes on a Live 3D Globe',
  },
  description:
    'Watch real-time lightning strikes worldwide and bet on where the next bolt will hit. Interactive 3D globe, live weather data, instant payouts.',
  keywords: [
    'lightning tracker',
    'lightning map live',
    'weather prediction game',
    'lightning strike map',
    'real-time lightning',
    'storm tracker game',
    'lightning betting',
    'weather game online',
  ],
  openGraph: {
    type: 'website',
    siteName: 'BoltBet',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://boltbet.com' },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BoltBet',
  applicationCategory: 'GameApplication',
  description: 'Real-time lightning prediction game with live 3D globe',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Real-time lightning data',
    'Interactive 3D globe',
    'Multiplayer predictions',
    'Live leaderboard',
  ],
}

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
        <BetModal />
      </body>
    </html>
  )
}