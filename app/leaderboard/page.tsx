import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'
import { GAME_SERVER_ENABLED, type LeaderboardEntry } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export const metadata: Metadata = {
  title: 'Leaderboard — Top Lightning Predictors',
  description:
    'See the top players ranked by tokens won predicting real-time lightning strikes.',
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!GAME_SERVER_ENABLED) return []
  try {
    const res = await fetch(`${API}/api/game/leaderboard/?limit=50`, { next: { revalidate: 60 } })
    if (res.ok) return (await res.json()) as LeaderboardEntry[]
  } catch {
    /* backend offline */
  }
  return []
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
        <p className="mt-2 text-white/55">Top lightning predictors by tokens won.</p>

        {entries.length === 0 ? (
          <div className="glass mt-8 rounded-2xl p-8 text-center text-white/55">
            The leaderboard goes live once the game backend is connected.
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {entries.map((e, i) => (
              <div
                key={e.username}
                className="glass flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/6"
              >
                <span className="font-display w-8 text-center text-lg">
                  {MEDAL[i] ?? <span className="text-white/40">{i + 1}</span>}
                </span>
                <span className="flex-1 font-medium">{e.username}</span>
                <span className="text-sm text-white/50">{e.wins} wins</span>
                <span className="font-display w-24 text-right font-bold text-bolt">
                  {e.tokens.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}