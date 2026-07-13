'use client'

import Image from 'next/image'
import { flagEmoji } from '@/lib/live/owm'
import type { LeaderboardSummary, Trophy } from '@/lib/api'
import { useT } from '@/lib/i18n/ui'
import LeaderboardProgressClient from './LeaderboardProgressClient'

type LoadResult =
  | { state: 'disabled' }
  | { state: 'error' }
  | { state: 'ok'; summary: LeaderboardSummary }

const MEDAL = ['🥇', '🥈', '🥉']

function TrophyIcon({ trophy }: { trophy: Trophy }) {
  return (
    <Image
      src={`/images/trophies/${trophy.image}`}
      alt={trophy.label}
      width={36}
      height={36}
      className="size-7 object-contain sm:size-9"
    />
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="glass mt-6 rounded-2xl p-5 text-center text-sm text-white/55 sm:mt-8 sm:p-8 sm:text-base">{children}</div>
}

function currentTierCount(trophies: Trophy[], index: number): number {
  const achieved = trophies[index].achievedCount ?? 0
  const nextAchieved = trophies[index + 1]?.achievedCount ?? 0
  return Math.max(0, achieved - nextAchieved)
}

function TrophyDistribution({ summary }: { summary: LeaderboardSummary }) {
  const { t } = useT()
  const noTrophyCount = Math.max(0, summary.totalPlayers - (summary.trophies[0]?.achievedCount ?? 0))

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 sm:p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{t('leaderboard.playersByTrophy')}</div>
      <div className="space-y-1.5">
        {[...summary.trophies].reverse().map((trophy) => {
          const originalIndex = summary.trophies.findIndex((item) => item.key === trophy.key)
          return (
            <div key={trophy.key} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
              <TrophyIcon trophy={trophy} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white/85 sm:text-sm">{trophy.label}</div>
                <div className="text-[11px] text-white/40">{t('leaderboard.pointsPlus', { points: trophy.points.toLocaleString() })}</div>
              </div>
              <div className="font-display text-base font-extrabold tabular-nums text-bolt sm:text-lg">
                {currentTierCount(summary.trophies, originalIndex).toLocaleString()}
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/35 sm:size-9">-</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-white/85 sm:text-sm">{t('leaderboard.noTrophy')}</div>
            <div className="text-[11px] text-white/40">{t('leaderboard.lessThanPoints', { points: 200 })}</div>
          </div>
          <div className="font-display text-base font-extrabold tabular-nums text-bolt sm:text-lg">{noTrophyCount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default function LeaderboardContent({ result }: { result: LoadResult }) {
  const { t } = useT()

  return (
    <div className="mx-auto w-[90vw] pb-20 pt-24 sm:w-[70vw] sm:pb-24 sm:pt-32">
      {result.state === 'disabled' && (
        <EmptyCard>{t('leaderboard.disabled')}</EmptyCard>
      )}

      {result.state === 'error' && (
        <EmptyCard>{t('leaderboard.error')}</EmptyCard>
      )}

      {result.state === 'ok' && (
        <section className="glass mt-4 rounded-3xl p-3 sm:mt-6 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-center">
            <div className="min-w-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-bolt/75 sm:text-xs sm:tracking-[0.25em]">{t('leaderboard.trophyRoad')}</p>
                <h2 className="font-display mt-1 text-lg font-extrabold sm:text-xl">{t('leaderboard.nextMilestone')}</h2>
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
        <EmptyCard>{t('leaderboard.empty')}</EmptyCard>
      )}

      <h2 className="font-display mt-8 text-2xl font-extrabold sm:mt-12 sm:text-4xl">{t('leaderboard.title')}</h2>
      <p className="mt-2 text-sm text-white/55 sm:text-base">{t('leaderboard.subtitle')}</p>

      {result.state === 'ok' && result.summary.entries.length > 0 && (
        <div className="mt-5 space-y-2 sm:mt-8">
          {result.summary.entries.map((entry, index) => (
            <div
              key={entry.username}
              className="glass grid grid-cols-[1.8rem_1.8rem_1fr_auto_auto] items-center gap-2 rounded-2xl px-3 py-3 text-sm transition hover:bg-white/6 sm:grid-cols-[3rem_2.5rem_1fr_auto_auto] sm:gap-3 sm:px-5 sm:py-4 sm:text-base"
            >
              <span className="font-display w-7 text-center text-base sm:w-8 sm:text-lg">
                {MEDAL[index] ?? <span className="text-white/40">{index + 1}</span>}
              </span>
              <span className="text-center text-lg leading-none sm:text-xl">{flagEmoji(entry.country || null)}</span>
              <div className="min-w-0">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="truncate">{entry.username}</span>
                  {entry.verified && (
                    <span className="hidden shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 sm:inline">
                      {t('leaderboard.verified')}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-white/40 sm:text-xs">
                  {t('leaderboard.record', { wins: entry.wins, games: entry.gamesPlayed })}
                </span>
              </div>
              <span className="font-display w-16 text-right text-sm font-bold text-bolt sm:w-28 sm:text-base">
                {entry.tokens.toLocaleString()}
              </span>
              <span className="flex w-8 justify-end sm:w-10">
                {entry.trophy ? (
                  <TrophyIcon trophy={entry.trophy} />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/30 sm:size-8">-</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
