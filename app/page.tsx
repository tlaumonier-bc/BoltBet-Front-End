// app/page.tsx — landing page.
// Single-viewport hero: the /live globe + LiveHUD. No scroll, so wheel/pinch
// zooms the Earth. Targeted countries glow on hover; clicking one lights its
// border up and orbits the camera onto it. (Page navigation comes next.)
import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import LiveHUD from '@/components/live/LiveHUD';
import { pages, launchablePages } from '@/lib/content/content';
import { boundsForLocale } from '@/lib/map/countryBounds';
import type { CountryLink } from '@/lib/globe/countryBorders';

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
      {/* ===== HERO: the /live experience, locked to one viewport ===== */}
      <section className="globe-drop relative h-svh w-full overflow-hidden bg-storm transform-[translateZ(0)]">
        <GlobeWrapper viewOnly fill enableZoom showZoomButtons countryLinks={COUNTRY_LINKS} />
        <LiveHUD />

        {/* The page still needs an h1 for SEO, even on the immersive hero. */}
        <h1 className="sr-only">
          Lightning Map Bets — live real-time lightning strike map &amp; 60-second prediction game
        </h1>
      </section>
    </main>
  );
}