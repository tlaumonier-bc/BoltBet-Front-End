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
import StrikeGamePanel from '@/components/game/StrikeGamePanel'
import BetBar from '@/components/game/BetBar'
import GameAccount from '@/components/game/GameAccount'
import { useStrikeGame, type StrikeGameVM } from '@/lib/game/useStrikeGame'
import { useSessionStore } from '@/store/sessionStore'
import { flagEmoji } from '@/lib/live/owm'

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

function MobileGameTopConsole({ vm }: { vm: StrikeGameVM }) {
  const [expanded, setExpanded] = useState(false)
  const yTicks = [vm.rollingTrendMax, Math.round(vm.rollingTrendMax / 2), 0]
  const points = vm.rollingTrend.map((value, index) => {
    const x = vm.rollingTrend.length === 1 ? 50 : (index / (vm.rollingTrend.length - 1)) * 100
    const y = 52 - (value / vm.rollingTrendMax) * 44
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[70px] z-40 w-[min(960px,94vw)] -translate-x-1/2 md:hidden">
      <div className="glass rounded-2xl border border-white/10 p-2 shadow-2xl">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-white/80">
            Higher or lower than <span className="font-bold text-electric">{vm.prevCount}</span> strikes in the next 30s?
          </p>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse strike graph' : 'Expand strike graph'}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8 text-sm font-black text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            {expanded ? '-' : '+'}
          </button>
        </div>
        {expanded && (
          <div className="mt-2 rounded-xl bg-white/[0.04] p-2">
            <div className="flex gap-2">
              <div className="flex h-20 w-6 shrink-0 flex-col justify-between text-right text-[9px] leading-none text-white/45">
                {yTicks.map((tick, index) => (
                  <span key={`${tick}-${index}`}>{tick}</span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
                  {yTicks.map((tick, index) => {
                    const y = 52 - (tick / vm.rollingTrendMax) * 44
                    return (
                      <line key={`${tick}-${index}`} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeWidth="0.5" className="text-white/15" vectorEffect="non-scaling-stroke" />
                    )
                  })}
                  <line x1="0" y1="8" x2="0" y2="52" stroke="currentColor" strokeWidth="0.5" className="text-white/25" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="52" x2="100" y2="52" stroke="currentColor" strokeWidth="0.5" className="text-white/25" vectorEffect="non-scaling-stroke" />
                  <polyline
                    points={points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="text-bolt"
                  />
                </svg>
                <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-white/35">
                  <span>t-30s</span>
                  <span>t-0s</span>
                </div>
              </div>
            </div>
          </div>
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
  const lastStrikeLabel = stats ? ago(stats.lastAgeSec) : 'Loading'

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[70px] z-40 w-[min(960px,94vw)] -translate-x-1/2 md:hidden">
      <div className="glass rounded-2xl border border-white/10 p-2 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden>
            {flagEmoji(country.iso2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white/85">{country.name}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/50">
              <span><span className="font-bold text-bolt">{lastHourLabel}</span> strikes · 1h</span>
              <span>last {lastStrikeLabel}</span>
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
  const setMode = useLiveStore((s) => s.setMode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)
  const sessionStatus = useSessionStore((s) => s.status)
  const isGame = mode === 'game'
  const gameSessionReady = sessionStatus === 'guest' || sessionStatus === 'authed'
  const showGamePanels = isGame && gameSessionReady
  const mobileSheet = useLiveStore((s) => s.mobileSheet)
  const setMobileSheet = useLiveStore((s) => s.setMobileSheet)

  // Always run the game clock so pending bets resolve even after switching modes.
  const vm = useStrikeGame()

  const toggleSheet = (sheet: Exclude<MobileSheet, null>) => {
    setMobileSheet(mobileSheet === sheet ? null : sheet)
  }

  const openGame = () => {
    setMode('game')
    setMobileSheet('game')
  }

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 hidden flex-col gap-3 md:flex md:right-auto md:w-75">
        {isGame && !gameSessionReady && <GameAccount />}
        <ModeBar />
        {mode !== 'free' && (!isGame || showGamePanels) && <LeftPanel pro={mode === 'pro' || isGame} />}
      </div>

      {/* Right column */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {showGamePanels ? (
          <StrikeGamePanel vm={vm} />
        ) : selectedCountry ? (
          <CountryPanel />
        ) : (
          !isGame && mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>

      {/* Bottom-centre betting bar (Game mode only) */}
      {showGamePanels && <BetBar vm={vm} />}

      {mobileSheet === 'game' && showGamePanels && <MobileGameTopConsole vm={vm} />}
      {selectedCountry && !mobileSheet && !isGame && <MobileCountryTopConsole country={selectedCountry} />}

      {/* Mobile-only action bar */}
      <div className="pointer-events-auto fixed bottom-2 left-2 right-2 z-50 md:hidden">
        <div className="glass flex gap-1.5 rounded-2xl border border-white/10 p-1.5 shadow-2xl">
          <MobileActionButton active={mobileSheet === 'layers'} onClick={() => toggleSheet('layers')}>
            Layers
          </MobileActionButton>
          <MobileActionButton active={mobileSheet === 'game'} onClick={openGame}>
            Game
          </MobileActionButton>
        </div>
      </div>

      {/* Mobile-only one-at-a-time bottom sheet */}
      {mobileSheet && (
        <div className="pointer-events-none fixed inset-x-2 bottom-17 z-50 md:hidden">
          <div className={`glass pointer-events-auto overflow-hidden rounded-2xl border border-white/10 p-2 shadow-2xl ${mobileSheet === 'layers' ? 'max-h-[42vh]' : 'max-h-[58vh]'}`}>
            <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                {mobileSheet === 'layers' ? 'Layers' : 'Game'}
              </span>
              <span className="min-w-0 truncate text-center text-xs font-semibold text-white/75">
                {mobileSheet === 'game' ? `${vm.scope.kind === 'country' ? flagEmoji(vm.scope.id || null) : '🌍'} ${vm.scope.label}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                aria-label="Close panel"
                className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className={`panel-scroll overflow-y-auto pr-1 text-sm ${mobileSheet === 'layers' ? 'max-h-[34vh]' : 'max-h-[50vh]'}`}>
              {mobileSheet === 'layers' && (
                <div className="space-y-2">
                  <ModeBar showModeSwitch={false} />
                  <LeftPanel pro showOrbit={false} title={null} showLayerTitle={false} compactLayers />
                </div>
              )}

              {mobileSheet === 'game' && (
                <div className="space-y-2">
                  <GameAccount />
                  {showGamePanels ? (
                    <BetBar vm={vm} variant="compact" />
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/55">
                      Preparing your game profile…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
