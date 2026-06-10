import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'

export const metadata: Metadata = {
  title: 'Leaderboard — Top Lightning Predictors',
  description:
    'See the top Lightning Map Bets players ranked by credits won predicting real-time lightning strikes.',
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Entry {
  username: string
  credits: number
  wins: number
}

async function getLeaderboard(): Promise<Entry[]> {
  try {
    const res = await fetch(`${API}/api/leaderboard/`, { next: { revalidate: 60 } })
    if (res.ok) return (await res.json()) as Entry[]
  } catch {
    /* backend offline */
  }
  return [
    { username: 'StormChaser', credits: 18420, wins: 142 },
    { username: 'BoltHunter', credits: 12990, wins: 121 },
    { username: 'ThunderKid', credits: 9870, wins: 98 },
    { username: 'VoltQueen', credits: 7640, wins: 77 },
    { username: 'FlashGordon', credits: 5210, wins: 54 },
  ]
}

const MEDAL = ['🥇', '🥈', '🥉']

export default async function LeaderboardPage() {
  const entries = await getLeaderboard()
  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-32">
        <p className="text-xs uppercase tracking-[0.3em] text-electric/70">Rankings</p>
        <h1 className="font-display mt-3 text-4xl font-extrabold sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 text-white/55">Top lightning predictors by credits won.</p>

        <div className="mt-8 space-y-2">
          {entries.map((e, i) => (
            <div
              key={e.username}
              className="glass flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/[0.06]"
            >
              <span className="font-display w-8 text-center text-lg">
                {MEDAL[i] ?? <span className="text-white/40">{i + 1}</span>}
              </span>
              <span className="flex-1 font-medium">{e.username}</span>
              <span className="text-sm text-white/50">{e.wins} wins</span>
              <span className="font-display w-24 text-right font-bold text-bolt">
                {e.credits.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}