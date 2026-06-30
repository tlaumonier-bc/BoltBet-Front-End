import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'
import LiveStrikeRanking from '@/components/how-it-works/LiveStrikeRanking'
import { site } from '@/lib/content/content'

export const metadata: Metadata = {
  title: 'How It Works — Live Lightning Globe & Prediction Game',
  description:
    'How the live lightning globe works: real-time strikes from the Blitzortung network, view modes and weather layers, clicking any country, and the Higher/Lower 30-second prediction game played with free virtual points.',
  keywords: [
    'how the lightning map works', 'real-time lightning globe', 'lightning prediction game',
    'blitzortung', 'lightning strike map', 'where is lightning striking now',
  ],
  alternates: { canonical: '/how-it-works' },
}

const MODES = [
  { name: 'Free', icon: '🌍', blurb: 'Just the globe — strikes flashing worldwide, nothing else on screen.' },
  { name: 'Beginner', icon: '⚡', blurb: 'Adds a live console: orbit shortcuts, strikes in the last hour, clouds and rain layers, and a running activity readout.' },
  { name: 'Pro', icon: '📡', blurb: 'Everything in Beginner plus 6h / 24h strike trails, temperature and wind layers, feed health, latency and signal-quality telemetry.' },
  { name: 'Game', icon: '🎯', blurb: 'Predict whether the next 30 seconds bring more or fewer strikes than the last — for free virtual points.' },
]

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

function PlayTimeline() {
  return (
    <div className="mt-5">
      <div className="flex overflow-hidden rounded-xl border border-white/10 text-center text-[11px] font-semibold">
        <div className="bg-electric/15 px-3 py-3 text-electric" style={{ flex: 1 }}>
          Previous 30s
          <span className="mt-1 block text-[10px] font-normal text-white/50">strikes counted</span>
        </div>
        <div className="bg-bolt/15 px-3 py-3 text-bolt" style={{ flex: 1 }}>
          Your play · next 30s
          <span className="mt-1 block text-[10px] font-normal text-white/50">strikes counted</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/40">
        There is no shared round timer. Your 30-second window starts the moment your play is accepted.
      </p>
    </div>
  )
}

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <p className="text-xs uppercase tracking-[0.3em] text-electric/70">How it works</p>
        <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
          Watch real <span className="text-gradient">lightning</span>. Then predict it.
        </h1>
        <p className="mt-3 text-white/55">
          {site.brand} is a live 3D globe of real lightning strikes worldwide, plus a quick prediction game. Here is everything it does.
        </p>

        {/* The globe */}
        <div className="glass mt-10 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">A live globe of real strikes</h2>
          <p className="mt-3 text-white/65">
            The globe streams real lightning strikes onto a 3D Earth the moment they are detected — each one flashes as a glowing
            bolt and fades after a couple of seconds. Click any country to fly in and open a panel with its strike count over the
            last hour, how active it is right now, and a history chart.
          </p>
          <p className="mt-3 text-white/65">
            The data comes from the Blitzortung community detection network: volunteer ground stations time the radio pulse from
            each strike and fix its position by triangulation. The more stations that hear a strike, the sharper the fix.
          </p>
        </div>

        {/* Modes */}
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold">Four ways to explore</h2>
          <p className="mt-2 text-white/55">
            Switch between modes from the mode bar, plus a Day / Night imagery toggle.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <div key={m.name} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none" aria-hidden>{m.icon}</span>
                  <span className="font-display text-base font-bold">{m.name}</span>
                </div>
                <p className="mt-2 text-sm text-white/60">{m.blurb}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/45">
            In Beginner and Pro you can layer live weather over the globe — clouds, rain, temperature and wind — and switch on
            strike trails from the last 1, 6 or 24 hours.
          </p>
        </div>

        {/* The game */}
        <div className="glass mt-10 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">Play: Higher or Lower</h2>
          <p className="mt-3 text-white/65">
            Game mode turns the globe into a fast prediction game. Play whenever you want, as long as you do not already
            have one in progress. The game snapshots the last 30 seconds, then you call whether the next 30 seconds will bring{' '}
            <span className="font-semibold text-emerald-300">Higher</span> (more) or{' '}
            <span className="font-semibold text-rose-300">Lower</span> (fewer) strikes.
          </p>
          <p className="mt-3 text-white/65">
            Get it right and you win <span className="font-semibold text-bolt">2×</span> your points. A tie returns your points (a
            push); a wrong call loses it.
          </p>

          <PlayTimeline />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/4 p-4">
              <div className="text-[10px] uppercase tracking-wider text-electric/70">Scope</div>
              <p className="mt-1.5 text-sm text-white/65">
                Play the whole globe, or click a country to predict just its strikes (it needs recent activity to be playable).
              </p>
            </div>
            <div className="rounded-xl bg-white/4 p-4">
              <div className="text-[10px] uppercase tracking-wider text-electric/70">Points</div>
              <p className="mt-1.5 text-sm text-white/65">
                Start with 100 free virtual points and claim 100 more whenever you run out. There is no real money.
              </p>
            </div>
            <div className="rounded-xl bg-white/4 p-4">
              <div className="text-[10px] uppercase tracking-wider text-electric/70">Leaderboard</div>
              <p className="mt-1.5 text-sm text-white/65">
                Sign in with Google to keep your points across devices and climb the leaderboard, ranked by points won.
              </p>
            </div>
          </div>
        </div>

        {/* Live ranking */}
        <div className="mt-12">
          <h2 className="font-display text-2xl font-bold">
            Where is lightning striking <span className="text-gradient">right now</span>?
          </h2>
          <p className="mt-2 text-white/55">
            A live ranking of where strikes are landing right now, built from the same feed that powers the globe.
          </p>
          <LiveStrikeRanking />
          <p className="mt-4 text-sm text-white/45">
            Over the long run, the most lightning-prone place on Earth is Lake Maracaibo in Venezuela, where storms flash almost
            every night of the year. But the ranking above is live — it shows where bolts are actually landing right now.
          </p>
        </div>

        <p className="mt-10 text-xs text-white/35">
          Strike data comes from the Blitzortung community detection network. The game uses virtual credits only — there is no
          real-money wagering.
        </p>
      </div>
    </main>
  )
}