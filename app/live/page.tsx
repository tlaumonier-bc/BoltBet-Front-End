// app/live/page.tsx
// View-only live globe — inspect real-time strikes with no game attached.
// Also a credibility/SEO asset (a genuine live weather tool).
// Requires the small `viewOnly` thread in LightningGlobe (see PATCHES.md) so
// clicking a zone does not open the betting/guess modal here.

import type { Metadata } from 'next';
import MapWrapper from '@/components/map/MapWrapper';

export const metadata: Metadata = {
  title: 'Live Lightning Globe — Real-Time Strikes Worldwide',
  description:
    'Inspect real-time lightning strikes worldwide on a live 3D globe. Powered by the Blitzortung community detection network.',
  alternates: { canonical: 'https://lightningmapbets.com/live' },
  robots: { index: true, follow: true },
};

export default function LivePage() {
  return (
    <main>
      <MapWrapper viewOnly />
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center">
        <p className="glass rounded-full px-4 py-2 text-xs text-white/70">
          Live strikes · Blitzortung network · view-only
        </p>
      </div>
    </main>
  );
}
