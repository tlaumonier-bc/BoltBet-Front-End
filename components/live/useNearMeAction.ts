'use client'

import { useState } from 'react'
import { getNearbyStrikes } from '@/lib/api'
import { useLiveStore } from '@/store/liveStore'

export type NearbyState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

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

export function useNearMeAction() {
  const [nearbyState, setNearbyState] = useState<NearbyState>('idle')
  const [nearbyMessage, setNearbyMessage] = useState('')
  const setSelectedCountry = useLiveStore((s) => s.setSelectedCountry)
  const setNearbyStrikes = useLiveStore((s) => s.setNearbyStrikes)
  const clearNearbyStrikes = useLiveStore((s) => s.clearNearbyStrikes)
  const orbitTo = useLiveStore((s) => s.orbitTo)
  const nearbyStrikes = useLiveStore((s) => s.nearbyStrikes)

  const resetNearby = () => {
    clearNearbyStrikes()
    setNearbyState('idle')
    setNearbyMessage('')
  }

  const nearMe = async () => {
    setNearbyState('loading')
    setNearbyMessage('Requesting location...')

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
    setNearbyMessage('Searching last hour...')

    try {
      const result = await getNearbyStrikes({ lat, lon, minutes: 60, limit: 30, radiusKm: 2500 })
      setSelectedCountry(null)
      setNearbyStrikes(result.strikes, { lat, lon })
      orbitTo({ id: 'near-me', label: 'Near me', lat, lon, flyHeightM: 1_800_000 })
      if (result.strikes.length) {
        const nearest = result.strikes[0].distance_km
        setNearbyState('ready')
        setNearbyMessage(`${result.strikes.length} strikes - nearest ${Math.round(nearest)} km`)
      } else {
        setNearbyState('empty')
        setNearbyMessage('No strikes nearby in the last hour')
      }
    } catch {
      setNearbyState('error')
      setNearbyMessage('Nearby strikes API unavailable')
    }
  }

  return {
    nearMe,
    nearbyMessage,
    nearbyState,
    nearbyStrikes,
    resetNearby,
  }
}
