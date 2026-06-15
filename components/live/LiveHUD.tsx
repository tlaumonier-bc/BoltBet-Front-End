'use client'
// components/live/LiveHUD.tsx — the /live console.
// Three view modes: Free (globe only), Beginner (left card), Pro (left + right).
// REAL data (strike rates, telemetry, sparkline, range) comes from the live
// Blitzortung feed; weather / storm cells / alerts / pulse are SAMPLE values
// shaped like the Xweather payloads they will be replaced by — see
// lib/live/locations.ts (only that file changes when the API ships).

import { useGameStore } from '@/store/gameStore'
import { useLiveStore, type LiveViewMode, type GlobeMapStyle } from '@/store/liveStore'
import {
  ORBIT_LOCATIONS,
  type AlertSample,
  type StormCellSample,
} from '@/lib/live/locations'
import { nearestStrike, useLiveStats } from '@/lib/live/useLiveStats'

const MODES: { id: LiveViewMode; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'pro', label: 'Pro' },
]

const MAP_STYLES: { id: GlobeMapStyle; label: string }[] = [
  { id: 'night', label: 'Night' },
  { id: 'day', label: 'Day' },
]

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const setMode = useLiveStore((s) => s.setMode)
  const mapStyle = useLiveStore((s) => s.mapStyle)
  const setMapStyle = useLiveStore((s) => s.setMapStyle)
  const atmosphere = useLiveStore((s) => s.atmosphere)
  const setAtmosphere = useLiveStore((s) => s.setAtmosphere)

  return (
    <>
      {/* Left column: map style + mode switch (always visible) + console (beginner / pro) */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <div className="glass pointer-events-auto flex shrink-0 self-start rounded-full p-1 text-xs font-semibold">
          {([
            { on: true, label: 'Atmosphere' },
            { on: false, label: 'Off' },
          ] as const).map((o) => (
            <button
              key={String(o.on)}
              onClick={() => setAtmosphere(o.on)}
              className={`rounded-full px-3.5 py-1.5 transition ${
                atmosphere === o.on
                  ? 'bg-electric text-storm shadow-[0_0_14px_rgba(56,189,248,0.45)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        
        {/* Day / Night globe imagery */}
        <div className="glass pointer-events-auto flex shrink-0 self-start rounded-full p-1 text-xs font-semibold">
          {MAP_STYLES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMapStyle(m.id)}
              className={`rounded-full px-3.5 py-1.5 transition ${
                mapStyle === m.id
                  ? 'bg-electric text-storm shadow-[0_0_14px_rgba(56,189,248,0.45)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Free / Beginner / Pro */}
        <div className="glass pointer-events-auto flex shrink-0 self-start rounded-full p-1 text-xs font-semibold">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full px-3.5 py-1.5 transition ${
                mode === m.id
                  ? 'bg-bolt text-storm shadow-[0_0_14px_rgba(253,224,71,0.45)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode !== 'free' && <LeftPanel pro={mode === 'pro'} />}
      </div>

      {/* Right column: pro mode, large screens only */}
      {mode === 'pro' && <RightPanel />}
    </>
  )
}

/* ============================== LEFT PANEL =============================== */

function LeftPanel({ pro }: { pro: boolean }) {
  const stats = useLiveStats()
  const orbitTarget = useLiveStore((s) => s.orbitTarget)
  const orbitTo = useLiveStore((s) => s.orbitTo)
  const clearOrbit = useLiveStore((s) => s.clearOrbit)

  const focus = orbitTarget
    ? ORBIT_LOCATIONS.find((l) => l.id === orbitTarget.id) ?? null
    : null

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 overflow-y-auto rounded-2xl p-4 max-md:max-h-[46vh]">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          Live console
        </span>
        <FeedBadge live={stats.feedLive} />
      </div>

      {/* ORBIT TO */}
      <Section
        title="Orbit to"
        badge={
          focus ? (
            <button
              onClick={clearOrbit}
              className="rounded-md px-1.5 py-0.5 text-[10px] text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear focused location"
            >
              {focus.short} ✕
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {ORBIT_LOCATIONS.map((loc) => {
            const active = orbitTarget?.id === loc.id
            return (
              <button
                key={loc.id}
                onClick={() =>
                  orbitTo({ id: loc.id, label: loc.label, lat: loc.lat, lon: loc.lon })
                }
                className={`rounded-lg border px-2.5 py-2 text-left transition ${
                  active
                    ? 'border-bolt/50 bg-bolt/10'
                    : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8'
                }`}
              >
                <span
                  className={`block text-xs font-semibold ${
                    active ? 'text-bolt' : 'text-white/85'
                  }`}
                >
                  {loc.short}
                </span>
                <span className="block text-[10px] text-white/40">
                  {coord(loc.lat, loc.lon)}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* STRIKES — real */}
      <Section title="Strikes">
        <div className="grid grid-cols-2 gap-2">
          <BigStat value={stats.perMinute} label="last 60 s" />
          <BigStat value={stats.last10Min} label="last 10 min" />
        </div>
        <Stat name="Hottest region" value={stats.topRegion ?? '—'} />
        {pro && (
          <>
            <Stat
              name="Session detections"
              value={stats.totalSession.toLocaleString('en-US')}
            />
            <Stat
              name="Last strike"
              value={
                stats.lastStrike
                  ? `${stats.lastStrike.region} · ${stats.lastStrike.ageSec}s ago`
                  : '—'
              }
            />
          </>
        )}
      </Section>

      {/* TELEMETRY — real */}
      <Section title="Telemetry">
        <Stat
          name="Feed"
          value={
            <span className={stats.feedLive ? 'text-emerald-400' : 'text-white/50'}>
              {stats.feedLive ? 'Live' : 'Idle'}
            </span>
          }
        />
        <Stat
          name="Avg latency"
          value={
            stats.avgLatencyMs != null
              ? `${(stats.avgLatencyMs / 1000).toFixed(1)} s`
              : '—'
          }
        />
        {pro && <QualityBar pct={stats.qualityPct} />}
      </Section>

      {/* WEATHER — sample (Xweather /conditions shape) */}
      <Section
        title={focus ? `Weather · ${focus.short}` : 'Weather'}
        badge={<SampleTag />}
      >
        {focus ? (
          <>
            <div className="flex items-end gap-2">
              <span className="font-display text-3xl font-bold text-white">
                {focus.wx.tempC}°C
              </span>
              <span className="pb-1 text-xs text-white/55">{focus.wx.condition}</span>
            </div>
            <Stat name="Wind" value={`${focus.wx.windKph} km/h ${focus.wx.windDir}`} />
            <Stat name="Humidity" value={`${focus.wx.humidity}%`} />
            {pro && (
              <>
                <Stat name="Pressure" value={`${focus.wx.pressureMb} mb`} />
                <Stat name="Dewpoint" value={`${focus.wx.dewpointC}°C`} />
                <Stat name="Cloud cover" value={`${focus.wx.cloudCover}%`} />
              </>
            )}
          </>
        ) : (
          <Empty>Pick a location above to load conditions.</Empty>
        )}
      </Section>

      <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/35">
        Strikes &amp; telemetry: live Blitzortung feed. Weather: sample values until
        the Xweather integration ships.
      </p>
    </div>
  )
}

/* ============================== RIGHT PANEL ============================== */

function RightPanel() {
  const stats = useLiveStats()
  const strikes = useGameStore((s) => s.strikes)
  const orbitTarget = useLiveStore((s) => s.orbitTarget)

  const focus = orbitTarget
    ? ORBIT_LOCATIONS.find((l) => l.id === orbitTarget.id) ?? null
    : null

  const near = focus ? nearestStrike(strikes, focus.lat, focus.lon, stats.now) : null
  const peak = Math.max(0, ...stats.buckets)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col lg:flex">
      <div className="glass panel-scroll pointer-events-auto min-h-0 overflow-y-auto rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
            Pro telemetry
          </span>
          <SampleTag label="partly sample" />
        </div>

        {/* ACTIVITY — real */}
        <Section title="Activity · last 15 min">
          <RateSparkline buckets={stats.buckets} />
          <div className="mt-1 flex justify-between text-[10px] text-white/40">
            <span>−15 min</span>
            <span>peak {peak}/min</span>
            <span>now</span>
          </div>
        </Section>

        {/* RANGE — real */}
        <Section title="Range">
          {focus ? (
            near ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="font-display text-3xl font-bold text-electric">
                    {Math.round(near.km).toLocaleString('en-US')}
                  </span>
                  <span className="pb-1 text-xs text-white/55">km</span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">
                  Nearest detection to {focus.short} · {near.ageSec}s ago
                </p>
              </>
            ) : (
              <Empty>No detections in the last 10 min.</Empty>
            )
          ) : (
            <Empty>Pick a location on the left.</Empty>
          )}
        </Section>

        {/* STORM CELLS — sample (Xweather /stormcells shape) */}
        <Section title="Storm cells" badge={<SampleTag />}>
          {focus ? (
            focus.wx.cells.length ? (
              <div className="space-y-1.5">
                {focus.wx.cells.map((c) => (
                  <StormCellRow key={c.id} cell={c} />
                ))}
              </div>
            ) : (
              <Empty>No tracked cells near {focus.short}.</Empty>
            )
          ) : (
            <Empty>Pick a location on the left.</Empty>
          )}
        </Section>

        {/* ALERTS — sample (Xweather /alerts shape) */}
        <Section title="Severe alerts" badge={<SampleTag />}>
          {focus ? (
            focus.wx.alerts.length ? (
              <div className="space-y-1.5">
                {focus.wx.alerts.map((a, i) => (
                  <AlertRow key={i} alert={a} />
                ))}
              </div>
            ) : (
              <Empty>No active alerts for {focus.short}.</Empty>
            )
          ) : (
            <Empty>Pick a location on the left.</Empty>
          )}
        </Section>

        {/* PULSE — sample (Xweather /lightning shape) */}
        <Section title="Pulse analysis" badge={<SampleTag />}>
          {focus ? (
            <>
              <PulseBar cgShare={focus.wx.pulse.cgShare} />
              <Stat name="Avg peak current" value={`${focus.wx.pulse.avgPeakKA} kA`} />
              <Stat name="CAPE" value={`${focus.wx.capeJkg.toLocaleString('en-US')} J/kg`} />
            </>
          ) : (
            <Empty>Pick a location on the left.</Empty>
          )}
        </Section>

        <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/35">
          Activity &amp; range: computed from the live feed. Cells, alerts &amp; pulse:
          sample data in Xweather format (stormcells / alerts / lightning endpoints).
        </p>
      </div>
    </div>
  )
}

/* ============================ SHARED PIECES ============================== */

function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-4 border-t border-white/10 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-electric/70">
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </section>
  )
}

function Stat({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
      <span className="text-white/45">{name}</span>
      <span className="text-right font-medium text-white/90">{value}</span>
    </div>
  )
}

function BigStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-white/4 px-3 py-2">
      <div className="font-display text-2xl font-bold text-bolt">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}

function FeedBadge({ live }: { live: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-medium">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live ? 'live-dot bg-bolt shadow-[0_0_8px_#fde047]' : 'bg-white/30'
        }`}
      />
      <span className={live ? 'text-bolt' : 'text-white/40'}>
        {live ? 'LIVE' : 'IDLE'}
      </span>
    </span>
  )
}

function SampleTag({ label = 'sample' }: { label?: string }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/35">
      {label}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/40">{children}</p>
}

function QualityBar({ pct }: { pct: { good: number; medium: number; bad: number } }) {
  return (
    <div className="mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-emerald-400" style={{ width: `${pct.good}%` }} />
        <div className="bg-bolt" style={{ width: `${pct.medium}%` }} />
        <div className="bg-red-400" style={{ width: `${pct.bad}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>good {pct.good}%</span>
        <span>med {pct.medium}%</span>
        <span>bad {pct.bad}%</span>
      </div>
    </div>
  )
}

function PulseBar({ cgShare }: { cgShare: number }) {
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-bolt" style={{ width: `${cgShare}%` }} />
        <div className="bg-electric/70" style={{ width: `${100 - cgShare}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span className="text-bolt/80">CG {cgShare}%</span>
        <span className="text-electric/80">IC {100 - cgShare}%</span>
      </div>
    </div>
  )
}

function RateSparkline({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets)
  const W = 272
  const H = 44
  const bw = W / buckets.length
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-11 w-full text-bolt"
      aria-label="Strikes per minute over the last 15 minutes"
    >
      {buckets.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 4))
        return (
          <rect
            key={i}
            x={i * bw + 1.5}
            y={H - h}
            width={bw - 3}
            height={h}
            rx={1.5}
            fill="currentColor"
            opacity={0.35 + 0.65 * (v / max)}
          />
        )
      })}
    </svg>
  )
}

const ALERT_STYLE: Record<AlertSample['severity'], string> = {
  warning: 'border-red-400/30 bg-red-400/10 text-red-300',
  watch: 'border-bolt/30 bg-bolt/10 text-bolt',
  advisory: 'border-electric/30 bg-electric/10 text-electric',
}

function AlertRow({ alert }: { alert: AlertSample }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${ALERT_STYLE[alert.severity]}`}
    >
      <span className="font-medium">{alert.event}</span>
      <span className="shrink-0 opacity-70">{alert.expires}</span>
    </div>
  )
}

function StormCellRow({ cell }: { cell: StormCellSample }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/4 px-2.5 py-1.5 text-[11px]">
      <span className="font-mono text-white/70">{cell.id}</span>
      <span className="text-white/50">
        {cell.bearing} · {cell.speedKph} km/h
      </span>
      <span className="text-white/50">hail {cell.hailProb}%</span>
      {cell.tag ? (
        <span className="rounded bg-red-400/15 px-1 py-0.5 text-[9px] font-bold text-red-300">
          {cell.tag}
        </span>
      ) : (
        <span className="text-white/25">—</span>
      )}
    </div>
  )
}

function coord(lat: number, lon: number) {
  const la = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
  return `${la} ${lo}`
}
