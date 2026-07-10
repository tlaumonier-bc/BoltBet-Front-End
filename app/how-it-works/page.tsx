import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'
import { site } from '@/lib/content/content'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How It Works — Live Lightning Globe & Prediction Game',
  description:
    'How the live lightning globe works: real-time strikes in the world, view modes and weather layers, clicking any country, and the Higher/Lower 30-second prediction game played with free virtual points.',
  keywords: [
    'how the lightning map works', 'real-time lightning globe', 'lightning prediction game',
    'live strikes', 'lightning strike map', 'where is lightning striking now',
  ],
  alternates: { canonical: '/how-it-works' },
}

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the live lightning globe?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A 3D globe that streams real lightning strikes from around the world onto the Earth the moment they are detected. Each strike flashes as a glowing bolt and fades after a couple of seconds.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where does the lightning data come from?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'From the Blitzortung community detection network. Volunteer ground stations time the radio pulse from each strike and fix its position by triangulation — the more stations that detect a strike, the sharper the fix.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the prediction game work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can start one active play at a time whenever you want. When you play, the game snapshots the previous 30 seconds for your chosen scope, then counts the next 30 seconds. You call whether the next window will bring more (Higher) or fewer (Lower) strikes than the previous one. A correct call pays 2x your points, a tie returns your points, and a wrong call loses them. You can play the whole globe or a single country.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the game played with real money?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The game uses free virtual points only. You start with 100 and can claim 100 more whenever you run out. There is no real-money wagering.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often does the map update?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'In real time: new strikes appear on the globe within seconds of being detected.',
      },
    },
  ],
}

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <HowItWorksContent brand={site.brand} />
    </main>
  )
}