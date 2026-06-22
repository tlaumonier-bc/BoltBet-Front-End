import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'
import { GAME_SERVER_ENABLED, type LeaderboardEntry } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export const metadata: Metadata = {
  title: 'Leaderboard — Top Lightning Predictors',
  description:
    'See the top players ranked by tokens won predicting real-time lightning strikes.',
  alternates: { canonical: '/leaderboard' },
}

type LoadResult =
  | { state: 'disabled' }
  | { state: 'error' }
  | { state: 'ok'; entries: LeaderboardEntry[] }

async function getLeaderboard(): Promise<LoadResult> {
  if (!GAME_SERVER_ENABLED) return { state: 'disabled' }
  try {
    const res = await fetch(`${API}/api/game/leaderboard/?limit=50`, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[leaderboard] backend returned', res.status, await res.text().catch(() => ''))
      return { state: 'error' }
    }
    const entries = (await res.json()) as LeaderboardEntry[]
    return { state: 'ok', entries }
  } catch (err) {
    console.error('[leaderboard] fetch failed:', err)
    return { state: 'error' }
  }
}

const MEDAL = ['🥇', '🥈', '🥉']

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="glass mt-8 rounded-2xl p-8 text-center text-white/55">{children}</div>
}

export default async function LeaderboardPage() {
  const result = await getLeaderboard()

  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-32">
        <p className="text-xs uppercase tracking-[0.3em] text-electric/70">Rankings</p>
        <h1 className="font-display mt-3 text-4xl font-extrabold sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 text-white/55">Top lightning predictors by tokens won.</p>

        {result.state === 'disabled' && (
          <EmptyCard>The leaderboard goes live once the game backend is connected.</EmptyCard>
        )}

        {result.state === 'error' && (
          <EmptyCard>The leaderboard could not be reached right now. Check back soon.</EmptyCard>
        )}

        {result.state === 'ok' && result.entries.length === 0 && (
          <EmptyCard>No games played yet — be the first on the board.</EmptyCard>
        )}

        {result.state === 'ok' && result.entries.length > 0 && (
          <div className="mt-8 space-y-2">
            {result.entries.map((e, i) => (
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