// store/liveStore.ts — state for the /live console.
import { create } from 'zustand'
import { DEFAULT_QUALITY, type GlobeQuality } from '@/lib/globe/quality'
import {
  defaultLayerState,
  type GlobeLayerId,
} from '@/lib/globe/layers'

export type LiveViewMode = 'free' | 'beginner' | 'pro'
export type GlobeMapStyle = 'night' | 'day'
export type { GlobeQuality }

export interface OrbitTarget {
  id: string
  label: string
  lat: number
  lon: number
  /** Camera altitude for the fly-to (m). Continents want a higher value than
   *  point locations; falls back to FLY_HEIGHT_M in camera.ts when omitted. */
  flyHeightM?: number
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
  quality: GlobeQuality
  setQuality: (quality: GlobeQuality) => void

  // ── Toggleable globe layers ──
  activeLayers: Record<GlobeLayerId, boolean>
  toggleLayer: (id: GlobeLayerId) => void
  setLayer: (id: GlobeLayerId, on: boolean) => void
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
  quality: DEFAULT_QUALITY,
  setQuality: (quality) => set({ quality }),

  activeLayers: defaultLayerState(),
  toggleLayer: (id) =>
    set((s) => ({ activeLayers: { ...s.activeLayers, [id]: !s.activeLayers[id] } })),
  setLayer: (id, on) =>
    set((s) => ({ activeLayers: { ...s.activeLayers, [id]: on } })),
}))
