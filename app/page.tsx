// app/page.tsx — landing page (this IS the live experience now).
import type { Metadata } from 'next';
import GlobeExperience from '@/components/experience/GlobeExperience';

export const metadata: Metadata = {
  title: 'Live Lightning Globe — Real-Time Strikes Worldwide',
  description:
    'Watch real-time lightning strikes worldwide on a live 3D globe. Click any country to zoom in and see its latest strikes. Powered by the Blitzortung community detection network.',
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <GlobeExperience />;
}