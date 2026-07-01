import type { Metadata } from 'next'
import Image from 'next/image'
import Backdrop from '@/components/Backdrop/Backdrop'
import { GAME_SERVER_ENABLED, getLeaderboardSummary, type LeaderboardSummary, type Trophy } from '@/lib/api'
import { flagEmoji } from '@/lib/live/owm'
import LeaderboardProgressClient from './LeaderboardProgressClient'

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

const MEDAL = ['🥇', '🥈', '🥉']

function TrophyIcon({ trophy }: { trophy: Trophy }) {
  return (
    <Image
      src={`/images/trophies/${trophy.image}`}
      alt={trophy.label}
      width={36}
      height={36}
      className="size-9 object-contain"
    />
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="glass mt-8 rounded-2xl p-8 text-center text-white/55">{children}</div>
}

function currentTierCount(trophies: Trophy[], index: number): number {
  const achieved = trophies[index].achievedCount ?? 0
  const nextAchieved = trophies[index + 1]?.achievedCount ?? 0
  return Math.max(0, achieved - nextAchieved)
}

function TrophyDistribution({ summary }: { summary: LeaderboardSummary }) {
  const noTrophyCount = Math.max(0, summary.totalPlayers - (summary.trophies[0]?.achievedCount ?? 0))
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Players by trophy</div>
      <div className="space-y-1.5">
        {[...summary.trophies].reverse().map((trophy) => {
          const originalIndex = summary.trophies.findIndex((item) => item.key === trophy.key)
          return (
            <div key={trophy.key} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2">
              <TrophyIcon trophy={trophy} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white/85">{trophy.label}</div>
                <div className="text-[11px] text-white/40">{trophy.points.toLocaleString()}+ points</div>
              </div>
              <div className="font-display text-lg font-extrabold tabular-nums text-bolt">
                {currentTierCount(summary.trophies, originalIndex).toLocaleString()}
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/35">-</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white/85">No trophy yet</div>
            <div className="text-[11px] text-white/40">Less than 200 points</div>
          </div>
          <div className="font-display text-lg font-extrabold tabular-nums text-bolt">{noTrophyCount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default async function LeaderboardPage() {
  const result = await getLeaderboard()

  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <div className="mx-auto w-[70vw] pb-24 pt-32">
        {result.state === 'disabled' && (
          <EmptyCard>The leaderboard goes live once the game backend is connected.</EmptyCard>
        )}

        {result.state === 'error' && (
          <EmptyCard>The leaderboard could not be reached right now. Check back soon.</EmptyCard>
        )}

        {result.state === 'ok' && (
          <section className="glass mt-6 rounded-3xl p-4 sm:p-5">
            <div className="grid gap-5 lg:grid-cols-[3fr_2fr] lg:items-center">
              <div className="min-w-0">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-bolt/75">Trophy Road</p>
                  <h2 className="font-display mt-1 text-xl font-extrabold">Your next milestone</h2>
                </div>
                <div className="relative mt-2 w-full">
                  <Image
                    src="/images/trophies/trophies.png"
                    alt="Lightning Map Game trophies"
                    width={720}
                    height={180}
                    className="h-auto w-full object-contain"
                    priority
                  />
                  <LeaderboardProgressClient trophies={result.summary.trophies} />
                </div>
              </div>
              <div className="min-w-0">
                <TrophyDistribution summary={result.summary} />
              </div>
            </div>
          </section>
        )}

        {result.state === 'ok' && result.summary.entries.length === 0 && (
          <EmptyCard>No games played yet — be the first on the board.</EmptyCard>
        )}

        
        <h2 className="font-display mt-12 text-3xl font-extrabold sm:text-4xl">Leaderboard</h2>
        <p className="mt-2 text-white/55">Top lightning predictors by points won.</p>

        {result.state === 'ok' && result.summary.entries.length > 0 && (
          <div className="mt-8 space-y-2">
            {result.summary.entries.map((e, i) => (
              <div
                key={e.username}
                className="glass grid grid-cols-[2.5rem_2.25rem_1fr_auto_auto] items-center gap-3 rounded-2xl px-5 py-4 transition hover:bg-white/6 sm:grid-cols-[3rem_2.5rem_1fr_auto_auto]"
              >
                <span className="font-display w-8 text-center text-lg">
                  {MEDAL[i] ?? <span className="text-white/40">{i + 1}</span>}
                </span>
                <span className="text-center text-xl leading-none">{flagEmoji(e.country || null)}</span>
                <div className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{e.username}</span>
                    {e.verified && (
                      <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                        Verified
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-white/40">{e.wins} wins · {e.gamesPlayed} games</span>
                </div>
                <span className="font-display w-28 text-right font-bold text-bolt">
                  {e.tokens.toLocaleString()}
                </span>
                <span className="flex w-10 justify-end">
                  {e.trophy ? (
                    <TrophyIcon trophy={e.trophy} />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/30">-</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}