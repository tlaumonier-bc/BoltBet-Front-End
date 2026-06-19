// store/liveStore.ts — state for the /live console.
import { create } from 'zustand'
import { DEFAULT_QUALITY, type GlobeQuality } from '@/lib/globe/quality'
import { defaultLayerState, type GlobeLayerId } from '@/lib/globe/layers'
import type { CountryStrike } from '@/lib/api'

export type LiveViewMode = 'free' | 'beginner' | 'pro' | 'game'
export type GlobeMapStyle = 'night' | 'day'
export type { GlobeQuality }

export interface OrbitTarget {
  id: string
  label: string
  lat: number
  lon: number
  flyHeightM?: number
  requestedAt: number
}

/** A country selected by clicking the globe. iso2 may be null for territories
 *  Natural Earth has no ISO-2 code for (the strikes layer is then disabled). */
export interface SelectedCountry {
  name: string
  iso2: string | null
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

  // ── Selected country + its "latest 1000 strikes" layer ──
  selectedCountry: SelectedCountry | null
  setSelectedCountry: (c: SelectedCountry | null) => void
  countryStrikesOn: boolean
  setCountryStrikesOn: (on: boolean) => void
  countryStrikes: CountryStrike[]
  setCountryStrikes: (rows: CountryStrike[]) => void

  // ── SEO text pane (slides up over the globe on a selected country) ──
  seoContentOpen: boolean
  setSeoContentOpen: (open: boolean) => void
}

export const useLiveStore = create<LiveStore>((set) => ({
  mode: 'beginner',
  setMode: (mode) => set({ mode }),
  orbitTarget: null,
  orbitTo: (target) => set({ orbitTarget: { ...target, requestedAt: Date.now() } }),
  clearOrbit: () => set({ orbitTarget: null }),
  mapStyle: 'day',
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

  selectedCountry: null,
  // Selecting a country turns the strikes layer ON by default and clears stale
  // points/stats; deselecting (null) turns it off.
  setSelectedCountry: (selectedCountry) =>
    set({
      selectedCountry,
      countryStrikesOn: !!selectedCountry,
      countryStrikes: [],
    }),
  countryStrikesOn: false,
  setCountryStrikesOn: (countryStrikesOn) => set({ countryStrikesOn }),
  countryStrikes: [],
  setCountryStrikes: (countryStrikes) => set({ countryStrikes }),

  seoContentOpen: false,
  setSeoContentOpen: (seoContentOpen) => set({ seoContentOpen }),
}))