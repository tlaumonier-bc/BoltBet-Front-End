// app/live/page.tsx
// View-only live globe + the LiveHUD console (Free / Beginner / Pro modes).
// viewOnly removes the multiplier grid on the globe and enables the
// "Orbit to" camera flights. The Blitzortung caption now lives inside
// LiveHUD and only shows in Free mode.

import type { Metadata } from 'next';
import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import LiveHUD from '@/components/live/LiveHUD';

export const metadata: Metadata = {
  title: 'Live Lightning Globe — Real-Time Strikes Worldwide',
  description:
    'Inspect real-time lightning strikes worldwide on a live 3D globe. Powered by the Blitzortung community detection network.',
  alternates: { canonical: 'https://lightningmapgames.com/live' },
  robots: { index: true, follow: true },
};

export default function LivePage() {
  return (
    <main>
      <GlobeWrapper viewOnly />
      <LiveHUD />
    </main>
  );
}
