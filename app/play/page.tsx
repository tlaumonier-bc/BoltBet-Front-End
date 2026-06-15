import type { Metadata } from 'next';
import PlayClient from './PlayClient';

export const metadata: Metadata = {
  title: 'Play — Guess the next 60 seconds of lightning',
  description:
    'Watch live lightning on the globe and lock a zone to capture the next strikes. Free to play, virtual points only.',
  robots: { index: false, follow: true },
};

export default function PlayPage() {
  return <PlayClient />;
}