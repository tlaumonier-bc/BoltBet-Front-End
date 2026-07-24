import type { Metadata } from 'next';
import GridGameClient from '@/components/grid-game/GridGameClient';

export const metadata: Metadata = {
  title: { absolute: 'Grid Game — Lightning Map Game' },
  description:
    'Distribute a stake across a live storm grid with inverse-density payout multipliers. Read where the storm is moving to beat the bot. Free to play.',
  alternates: { canonical: '/grid-game' },
  robots: { index: true, follow: true },
};

export default function GridGamePage() {
  return <GridGameClient />;
}
