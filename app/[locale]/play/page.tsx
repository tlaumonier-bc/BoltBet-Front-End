// app/[locale]/play/page.tsx
// The game (funnel target). Renders the existing 3D globe + HUD. Static `play`
// segment takes priority over [slug], so it won't collide with SEO pages.
// noindex: per the strategy the game is a conversion layer, never an SEO target.

import type { Metadata } from 'next';
import MapWrapper from '@/components/map/MapWrapper';
import { pages } from '@/lib/content/content';

export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from(new Set(pages.map((p) => p.locale))).map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Play — Guess the next 60 seconds of lightning',
  description:
    'Watch live lightning on the globe and guess whether more or fewer strikes hit in the next 60 seconds. Free to play, virtual credits only — no real money.',
  robots: { index: false, follow: true },
};

export default function LocalePlayPage() {
  return (
    <main>
      <MapWrapper />
    </main>
  );
}
