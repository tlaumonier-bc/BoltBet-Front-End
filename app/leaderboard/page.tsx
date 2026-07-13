import type { Metadata } from 'next'
import Backdrop from '@/components/Backdrop/Backdrop'
import { GAME_SERVER_ENABLED, getLeaderboardSummary, type LeaderboardSummary } from '@/lib/api'
import LeaderboardContent from './LeaderboardContent'

export const metadata: Metadata = {
  title: 'Leaderboard — Top Lightning Predictors',
  description:
    'See the top players ranked by points won predicting real-time lightning strikes.',
  alternates: { canonical: '/leaderboard' },
}

type LoadResult =
  | { state: 'disabled' }
  | { state: 'error' }
  | { state: 'ok'; summary: LeaderboardSummary }

async function getLeaderboard(): Promise<LoadResult> {
  if (!GAME_SERVER_ENABLED) return { state: 'disabled' }
  try {
    const summary = await getLeaderboardSummary(50)
    return { state: 'ok', summary }
  } catch (err) {
    console.error('[leaderboard] fetch failed:', err)
    return { state: 'error' }
  }
}

export default async function LeaderboardPage() {
  const result = await getLeaderboard()

  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <LeaderboardContent result={result} />
    </main>
  )
}