// app/page.tsx — landing page (this IS the live experience now).
import type { Metadata } from 'next';
import GlobeExperience from '@/components/experience/GlobeExperience';

export const metadata: Metadata = {
  title: 'Lightning Map Game — Live Lightning Map & Real-Time Strikes Worldwide',
  description:
    'Watch real-time lightning strikes worldwide on a live 3D globe. Click any country to zoom in and see its latest strikes.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <GlobeExperience />;
}