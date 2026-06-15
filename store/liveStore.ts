// store/liveStore.ts — state for the /live console.
import { create } from 'zustand'

export type LiveViewMode = 'free' | 'beginner' | 'pro'
export type GlobeMapStyle = 'night' | 'day'

export interface OrbitTarget {
  id: string
  label: string
  lat: number
  lon: number
  requestedAt: number
}

interface LiveStore {
  mode: LiveViewMode
  setMode: (mode: LiveViewMode) => void
  orbitTarget: OrbitTarget | null
  orbitTo: (target: Omit<OrbitTarget, 'requestedAt'>) => void
  clearOrbit: () => void
  mapStyle: GlobeMapStyle
  setMapStyle: (style: GlobeMapStyle) => void
  atmosphere: boolean
  setAtmosphere: (on: boolean) => void
}

export const useLiveStore = create<LiveStore>((set) => ({
  mode: 'beginner',
  setMode: (mode) => set({ mode }),
  orbitTarget: null,
  orbitTo: (target) => set({ orbitTarget: { ...target, requestedAt: Date.now() } }),
  clearOrbit: () => set({ orbitTarget: null }),
  mapStyle: 'night',
  setMapStyle: (mapStyle) => set({ mapStyle }),
  atmosphere: true,
  setAtmosphere: (atmosphere) => set({ atmosphere }),
}))