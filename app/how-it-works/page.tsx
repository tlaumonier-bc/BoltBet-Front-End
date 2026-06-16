import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'

export const metadata: Metadata = {
  title: 'How It Works — Predict Real Lightning Strikes in Real Time',
  description:
    'Learn how Lightning Map Bets works: how the live lightning strike map updates, how multipliers are calculated, and where lightning strikes most on Earth.',
  keywords: [
    'how to predict lightning strikes',
    'lightning strike map real time',
    'where does lightning strike most',
    'lightning prediction',
  ],
}

const TOP_ZONES = [
  { rank: 1, region: 'Lake Maracaibo, Venezuela', flashes: '~233 / km²·yr' },
  { rank: 2, region: 'Kabare, DR Congo', flashes: '~205 / km²·yr' },
  { rank: 3, region: 'Kampene, DR Congo', flashes: '~176 / km²·yr' },
  { rank: 4, region: 'Caceres, Colombia', flashes: '~173 / km²·yr' },
  { rank: 5, region: 'Sake, DR Congo', flashes: '~143 / km²·yr' },
  { rank: 6, region: 'Daggar, Pakistan', flashes: '~143 / km²·yr' },
  { rank: 7, region: 'El Tarra, Colombia', flashes: '~138 / km²·yr' },
  { rank: 8, region: 'Nguti, Cameroon', flashes: '~129 / km²·yr' },
  { rank: 9, region: 'Butembo, DR Congo', flashes: '~129 / km²·yr' },
  { rank: 10, region: 'Boende, DR Congo', flashes: '~127 / km²·yr' },
]

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the lightning strike map work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lightning Map Bets streams real-time lightning detections onto a live 3D globe. Each strike appears as a bolt at its detected latitude and longitude, fading over a couple of seconds.',
      },
    },
    {
      '@type': 'Question',
      name: 'How are multipliers calculated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Multipliers reflect recent strike frequency in a zone. Calm zones with few strikes pay larger multipliers; active storm zones pay smaller ones because a strike is more likely.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Lightning Map Bets a real-money game?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Lightning Map Bets uses virtual in-game credits only. There is no real-money wagering.',
      },
    },
  ],
}

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <p className="text-xs uppercase tracking-[0.3em] text-electric/70">How it works</p>
        <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
          Predict real <span className="text-gradient">lightning</span> strikes in real time
        </h1>

        <div className="glass mt-10 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">What is the Lightning Strike Map?</h2>
          <p className="mt-3 text-white/65">
            The map is a live 3D globe showing lightning detections as they happen around
            the world. The surface is divided into 162 zones, each covering a 20° by 20°
            area. As bolts land, you see them flash on the globe in real time.
          </p>
        </div>

        <div className="glass mt-6 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">How Are Multipliers Calculated?</h2>
          <p className="mt-3 text-white/65">
            Each zone carries a multiplier driven by how active it is. Quiet zones offer
            high multipliers because a strike there is unlikely; stormy zones offer low
            multipliers because a strike is almost guaranteed. Pick a zone, choose a window
            of 5 minutes to 1 hour, and if a strike lands inside it before time runs out,
            you win your stake times the multiplier — in virtual credits.
          </p>
        </div>

        <h2 className="font-display mt-12 text-2xl font-bold">
          Where Does Lightning Strike Most? <span className="text-white/40">(Top 10 zones)</span>
        </h2>
        <div className="glass mt-4 overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 text-right font-medium">Flash density</th>
              </tr>
            </thead>
            <tbody>
              {TOP_ZONES.map((z) => (
                <tr key={z.rank} className="border-b border-white/5 transition hover:bg-white/3">
                  <td className="px-5 py-3 font-display text-white/40">{z.rank}</td>
                  <td className="px-5 py-3">{z.region}</td>
                  <td className="px-5 py-3 text-right font-medium text-bolt">{z.flashes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/35">
          Densities are approximate, based on satellite lightning climatology.
        </p>
      </div>
    </main>
  )
}