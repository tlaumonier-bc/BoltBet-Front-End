'use client'
// components/live/OrbitSection.tsx — "Back to globe" reset + "Orbit to" continents.
import { useState } from 'react'
import { getNearbyStrikes } from '@/lib/api'
import { useLiveStore } from '@/store/liveStore'
import { ORBIT_LOCATIONS } from '@/lib/live/locations'
import { Section, coord } from './hudShared'

export default function OrbitSection() {
  const [nearbyState, setNearbyState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle')
  const [nearbyMessage, setNearbyMessage] = useState('')
  const mode = useLiveStore((s) => s.mode)
  const orbitTarget = useLiveStore((s) => s.orbitTarget)
  const nearbyStrikes = useLiveStore((s) => s.nearbyStrikes)
  const orbitTo = useLiveStore((s) => s.orbitTo)
  const clearOrbit = useLiveStore((s) => s.clearOrbit)
  const setSelectedCountry = useLiveStore((s) => s.setSelectedCountry)
  const setNearbyStrikes = useLiveStore((s) => s.setNearbyStrikes)
  const clearNearbyStrikes = useLiveStore((s) => s.clearNearbyStrikes)
  const focus = orbitTarget
    ? ORBIT_LOCATIONS.find((l) => l.id === orbitTarget.id) ?? null
    : null

  const onGlobe = orbitTarget?.id === 'globe'
  const backToGlobe = () => {
    if (mode === 'game') setSelectedCountry(null)
    clearNearbyStrikes()
    setNearbyState('idle')
    setNearbyMessage('')
    orbitTo({ id: 'globe', label: 'Whole globe', lat: 20, lon: 0, flyHeightM: 20_000_000 })
  }

  const geolocationErrorMessage = (error: unknown) => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Use http://localhost or HTTPS for location'
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: number }).code
      if (code === 1) return 'Location permission denied'
      if (code === 2) return 'Location unavailable from browser'
      if (code === 3) return 'Location request timed out'
    }
    if (error instanceof Error && error.message === 'geolocation_unavailable') {
      return 'Geolocation is not supported here'
    }
    return 'Location unavailable'
  }

  const locate = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation_unavailable'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 5 * 60_000,
        timeout: 12_000,
      })
    })

  const nearMe = async () => {
    setNearbyState('loading')
    setNearbyMessage('Requesting location…')
    let pos: GeolocationPosition
    try {
      pos = await locate()
    } catch (error) {
      setNearbyState('error')
      setNearbyMessage(geolocationErrorMessage(error))
      return
    }

    const lat = pos.coords.latitude
    const lon = pos.coords.longitude
    setNearbyMessage('Searching last hour…')
    try {
      const result = await getNearbyStrikes({ lat, lon, minutes: 60, limit: 30, radiusKm: 2500 })
      setSelectedCountry(null)
      setNearbyStrikes(result.strikes, { lat, lon })
      orbitTo({ id: 'near-me', label: 'Near me', lat, lon, flyHeightM: 1_800_000 })
      if (result.strikes.length) {
        const nearest = result.strikes[0].distance_km
        setNearbyState('ready')
        setNearbyMessage(`${result.strikes.length} strikes · nearest ${Math.round(nearest)} km`)
      } else {
        setNearbyState('empty')
        setNearbyMessage('No strikes nearby in the last hour')
      }
    } catch {
      setNearbyState('error')
      setNearbyMessage('Nearby strikes API unavailable')
    }
  }

  return (
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
      <button
        onClick={nearMe}
        disabled={nearbyState === 'loading'}
        className={`mb-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-semibold transition ${
          orbitTarget?.id === 'near-me'
            ? 'border-bolt/50 bg-bolt/10 text-bolt'
            : 'border-white/10 bg-white/4 text-white/85 hover:border-white/25 hover:bg-white/8'
        } disabled:cursor-wait disabled:opacity-70`}
      >
        <span aria-hidden>📍</span>
        {nearbyState === 'loading' ? 'Finding nearby strikes…' : 'Near me'}
      </button>
      {(nearbyMessage || nearbyStrikes.length > 0) && (
        <p className={`mb-2 text-[10px] ${nearbyState === 'error' ? 'text-rose-300' : 'text-white/45'}`}>
          {nearbyMessage || `${nearbyStrikes.length} nearby strikes`}
        </p>
      )}

      <button
        onClick={backToGlobe}
        className={`mb-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-semibold transition ${
          onGlobe
            ? 'border-electric/50 bg-electric/10 text-electric'
            : 'border-white/10 bg-white/4 text-white/85 hover:border-white/25 hover:bg-white/8'
        }`}
      >
        <span aria-hidden>🌍</span>
        Back to globe
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        {ORBIT_LOCATIONS.map((loc) => {
          const active = orbitTarget?.id === loc.id
          return (
            <button
              key={loc.id}
              onClick={() =>
                orbitTo({
                  id: loc.id,
                  label: loc.label,
                  lat: loc.lat,
                  lon: loc.lon,
                  flyHeightM: loc.flyHeightM,
                })
              }
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                active
                  ? 'border-bolt/50 bg-bolt/10'
                  : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8'
              }`}
            >
              <span className={`block text-xs font-semibold ${active ? 'text-bolt' : 'text-white/85'}`}>
                {loc.short}
              </span>
              <span className="block text-[10px] text-white/40">{coord(loc.lat, loc.lon)}</span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}