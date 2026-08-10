'use client'
// components/live/LiveHUD.tsx — shell of the globe console.
import { useEffect, useMemo, useState } from 'react'
import { useLiveStore, type MobileSheet, type SelectedCountry } from '@/store/liveStore'
import { useGameStore } from '@/store/gameStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'
import StrikeHistoryChart from './StrikeHistoryChart'
import { flagEmoji } from '@/lib/live/owm'
import { useNearMeAction } from './useNearMeAction'
import { useT } from '@/lib/i18n/ui'

function MobileActionButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 flex-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
        active
          ? 'bg-bolt text-storm shadow-[0_0_18px_rgba(253,224,71,0.35)]'
          : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function MobileNearMeButton() {
  const orbitTarget = useLiveStore((s) => s.orbitTarget)
  const { nearMe, nearbyMessage, nearbyState, nearbyStrikes } = useNearMeAction()
  const active = orbitTarget?.id === 'near-me'
  const { t } = useT()

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[70px] z-40 w-[min(960px,94vw)] -translate-x-1/2 md:hidden">
      <div className="glass rounded-2xl border border-white/10 p-1.5 shadow-2xl">
        <button
          type="button"
          onClick={nearMe}
          disabled={nearbyState === 'loading'}
          className={`flex min-h-9 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
            active
              ? 'bg-bolt text-storm shadow-[0_0_18px_rgba(253,224,71,0.35)]'
              : 'bg-white/8 text-white/80 hover:bg-white/12 hover:text-white'
          } disabled:cursor-wait disabled:opacity-70`}
        >
          <span aria-hidden>📍</span>
          {nearbyState === 'loading' ? t('live.findingNearby') : t('live.nearMe')}
        </button>
        {(nearbyMessage || nearbyStrikes.length > 0) && (
          <p className={`px-2 pb-1 pt-1 text-center text-[10px] ${nearbyState === 'error' ? 'text-rose-300' : 'text-white/50'}`}>
            {nearbyMessage || t('live.nearbyStrikes', { count: nearbyStrikes.length })}
          </p>
        )}
      </div>
    </div>
  )
}

function ago(sec: number): string {
  if (sec < 5) return 'Now'
  if (sec < 90) return `${sec}s ago`
  const min = Math.round(sec / 60)
  return min < 60 ? `${min}m ago` : `${Math.round(min / 60)}h ago`
}

function MobileCountryTopConsole({ country }: { country: SelectedCountry }) {
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const rows = useLiveStore((s) => s.countryStrikes)
  const strikeMeta = useLiveStore((s) => s.countryStrikeMeta)
  const { t } = useT()

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const liveLastAgeSec = useMemo(() => {
    const iso = country.iso2
    if (!iso) return null
    const target = iso.toUpperCase()
    const strikes = useGameStore.getState().strikes
    for (const strike of strikes) {
      if (strike.country && strike.country.toUpperCase() === target) {
        return Math.max(0, Math.round((now - strike.receivedAt) / 1000))
      }
    }
    return null
  }, [country.iso2, now])

  const stats = useMemo(() => {
    if (!rows.length) return null
    const receivedAt = (row: { received_at: string }) => Date.parse(row.received_at)
    const newest = receivedAt(rows[0])
    let lastHour = 0
    for (const row of rows) {
      if (now - receivedAt(row) <= 3_600_000) lastHour++
    }
    const polledAgeSec = Math.max(0, Math.round((now - newest) / 1000))
    return {
      lastHour,
      lastAgeSec: liveLastAgeSec != null ? Math.min(liveLastAgeSec, polledAgeSec) : polledAgeSec,
    }
  }, [rows, now, liveLastAgeSec])

  const lastHourLabel = strikeMeta?.cappedLastHour
    ? `> ${strikeMeta.limit.toLocaleString()}`
    : (strikeMeta?.lastHour ?? stats?.lastHour ?? 0).toLocaleString()
  const lastStrikeLabel = stats ? ago(stats.lastAgeSec) : t('countryPanel.loading')

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[126px] z-40 w-[min(960px,94vw)] -translate-x-1/2 md:hidden">
      <div className="glass rounded-2xl border border-white/10 p-2 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden>
            {flagEmoji(country.iso2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white/85">{country.name}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/50">
              <span><span className="font-bold text-bolt">{lastHourLabel}</span> {t('countryPanel.strikesLastHour')}</span>
              <span>{t('countryPanel.lastStrike')} {lastStrikeLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse country strike history' : 'Expand country strike history'}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8 text-sm font-black text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            {expanded ? '-' : '+'}
          </button>
        </div>
        {expanded && <StrikeHistoryChart rows={rows} now={now} />}
      </div>
    </div>
  )
}

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)
  const mobileSheet = useLiveStore((s) => s.mobileSheet)
  const setMobileSheet = useLiveStore((s) => s.setMobileSheet)
  const { t } = useT()

  const toggleSheet = (sheet: Exclude<MobileSheet, null>) => {
    setMobileSheet(mobileSheet === sheet ? null : sheet)
  }

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 hidden flex-col gap-3 md:flex md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro'} />}
      </div>

      {/* Right column */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>

      <MobileNearMeButton />
      {selectedCountry && !mobileSheet && <MobileCountryTopConsole country={selectedCountry} />}

      {/* Mobile-only action bar */}
      <div className="pointer-events-auto fixed bottom-2 left-2 right-2 z-50 md:hidden">
        <div className="glass flex gap-1.5 rounded-2xl border border-white/10 p-1.5 shadow-2xl">
          <MobileActionButton active={mobileSheet === 'layers'} onClick={() => toggleSheet('layers')}>
            {t('live.layers')}
          </MobileActionButton>
        </div>
      </div>

      {/* Mobile-only bottom sheet (Layers) */}
      {mobileSheet && (
        <div className="pointer-events-none fixed inset-x-2 bottom-17 z-50 md:hidden">
          <div className="glass pointer-events-auto max-h-[42vh] overflow-hidden rounded-2xl border border-white/10 p-2 shadow-2xl">
            <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                {t('live.layers')}
              </span>
              <span />
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                aria-label="Close panel"
                className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                {t('live.close')}
              </button>
            </div>
            <div className="panel-scroll max-h-[34vh] overflow-y-auto pr-1 text-sm">
              <div className="space-y-2">
                <ModeBar showModeSwitch={false} />
                <LeftPanel pro showOrbit={false} title={null} showLayerTitle={false} compactLayers />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
