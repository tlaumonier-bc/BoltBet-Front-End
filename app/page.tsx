// app/page.tsx — landing page (this IS the live experience now).
import type { Metadata } from 'next';
import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import LiveHUD from '@/components/live/LiveHUD';
import { pages, launchablePages } from '@/lib/content/content';
import { boundsForLocale } from '@/lib/map/countryBounds';
import type { CountryLink } from '@/lib/globe/countryBorders';

export const metadata: Metadata = {
  title: 'Live Lightning Globe — Real-Time Strikes Worldwide',
  description:
    'Watch real-time lightning strikes worldwide on a live 3D globe. Click any country to zoom in and see its latest strikes. Powered by the Blitzortung community detection network.',
  robots: { index: true, follow: true },
};

const live = launchablePages();
const COUNTRY_LINKS: CountryLink[] = (live.length ? live : pages).map((p) => {
  const b = boundsForLocale(p.locale);
  return {
    iso: p.locale,
    names: [p.country, b.label].filter(Boolean) as string[],
    slug: p.slug,
    center: { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 },
    label: b.label,
  };
});

export default function HomePage() {
  return (
    <main className="relative h-svh overflow-hidden">
      <section className="globe-drop relative h-svh w-full overflow-hidden bg-storm transform-[translateZ(0)]">
        <GlobeWrapper viewOnly fill enableZoom countryLinks={COUNTRY_LINKS} />
        <LiveHUD />
        <h1 className="sr-only">
          Lightning Map Bets — live real-time lightning strike map &amp; 60-second prediction game
        </h1>
      </section>
    </main>
  );
}