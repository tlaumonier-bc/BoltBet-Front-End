import type { Metadata } from 'next';
import GridGameClient from '@/components/grid-game/GridGameClient';

export const metadata: Metadata = {
  title: { absolute: 'Grid Game — Lightning Map Game' },
  description: 'Play a fast 1v1 lightning grid game on the most active countries right now.',
  alternates: { canonical: '/grid-game' },
  robots: { index: true, follow: true },
};

export default function GridGamePage() {
  return <GridGameClient />;
}
