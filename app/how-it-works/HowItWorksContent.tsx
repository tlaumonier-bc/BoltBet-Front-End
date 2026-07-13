'use client'

import LiveStrikeRanking from '@/components/how-it-works/LiveStrikeRanking'
import { useT } from '@/lib/i18n/ui'

const MODES = [
  { id: 'free', icon: '🌍' },
  { id: 'beginner', icon: '⚡' },
  { id: 'pro', icon: '📡' },
  { id: 'game', icon: '🎯' },
] as const

function PlayTimeline() {
  const { t } = useT()

  return (
    <div className="mt-4 sm:mt-5">
      <div className="flex overflow-hidden rounded-xl border border-white/10 text-center text-[10px] font-semibold sm:text-[11px]">
        <div className="bg-electric/15 px-2 py-2.5 text-electric sm:px-3 sm:py-3" style={{ flex: 1 }}>
          {t('how.timelinePrevious')}
          <span className="mt-1 block text-[10px] font-normal text-white/50">{t('how.timelineCounted')}</span>
        </div>
        <div className="bg-bolt/15 px-2 py-2.5 text-bolt sm:px-3 sm:py-3" style={{ flex: 1 }}>
          {t('how.timelinePlay')}
          <span className="mt-1 block text-[10px] font-normal text-white/50">{t('how.timelineCounted')}</span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/40">{t('how.timelineNote')}</p>
    </div>
  )
}

export default function HowItWorksContent({ brand }: { brand: string }) {
  const { t } = useT()

  return (
    <div className="mx-auto w-[90vw] pb-20 pt-24 text-sm sm:w-[70vw] sm:pb-24 sm:pt-32 sm:text-base">
      <p className="text-[10px] uppercase tracking-[0.24em] text-electric/70 sm:text-xs sm:tracking-[0.3em]">{t('how.eyebrow')}</p>
      <h1 className="font-display mt-3 text-3xl font-extrabold leading-tight sm:text-5xl">
        {t('how.heroBefore')} <span className="text-gradient">{t('how.heroHighlight')}</span>. {t('how.heroAfter')}
      </h1>
      <p className="mt-3 leading-relaxed text-white/55">{t('how.intro', { brand })}</p>

      <div className="mt-8 sm:mt-10">
        <h2 className="font-display text-xl font-bold sm:text-2xl">{t('how.modesTitle')}</h2>
        <p className="mt-2 leading-relaxed text-white/55">{t('how.modesIntro')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <div key={mode.id} className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-lg leading-none sm:text-xl" aria-hidden>{mode.icon}</span>
                <span className="font-display text-base font-bold">{t(`how.mode.${mode.id}.name`)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{t(`how.mode.${mode.id}.blurb`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/45">{t('how.weatherNote')}</p>
      </div>

      <div className="glass mt-8 rounded-2xl p-4 sm:mt-10 sm:p-6">
        <h2 className="font-display text-lg font-bold sm:text-xl">{t('how.gameTitle')}</h2>
        <p className="mt-2 leading-relaxed text-white/65 sm:mt-3">
          {t('how.gameBodyBefore')}{' '}
          <span className="font-semibold text-emerald-300">{t('how.higher')}</span> {t('how.gameBodyMiddle')}{' '}
          <span className="font-semibold text-rose-300">{t('how.lower')}</span> {t('how.gameBodyAfter')}
        </p>
        <p className="mt-3 leading-relaxed text-white/65">{t('how.payoutBody')}</p>

        <PlayTimeline />

        <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3">
          {(['scope', 'points', 'leaderboard'] as const).map((item) => (
            <div key={item} className="rounded-xl bg-white/4 p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-wider text-electric/70">{t(`how.card.${item}.title`)}</div>
              <p className="mt-1.5 text-sm text-white/65">{t(`how.card.${item}.body`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 sm:mt-12">
        <h2 className="font-display text-xl font-bold sm:text-2xl">
          {t('how.liveTitleBefore')} <span className="text-gradient">{t('how.liveTitleHighlight')}</span>?
        </h2>
        <p className="mt-2 leading-relaxed text-white/55">{t('how.liveIntro')}</p>
        <LiveStrikeRanking />
        <p className="mt-4 text-sm leading-relaxed text-white/45">{t('how.liveNote')}</p>
      </div>
    </div>
  )
}
