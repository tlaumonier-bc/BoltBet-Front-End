// store/liveStore.ts — state for the /live console.
// Bridges the DOM HUD (components/live/LiveHUD.tsx) and the 3D globe
// (components/Globe/LightningGlobe.tsx): the HUD sets the view mode and the
// "orbit to" target; the globe's OrbitFlight reads the target and flies there.

import { create } from 'zustand'

export type LiveViewMode = 'free' | 'beginner' | 'pro'

export interface OrbitTarget {
  id: string
  label: string
  lat: number
  lon: number
  requestedAt: number // lets the globe detect a re-click on the same location
}

interface LiveStore {
  mode: LiveViewMode
  setMode: (mode: LiveViewMode) => void
  /** Doubles as the "focused location" the weather/pro panels describe. */
  orbitTarget: OrbitTarget | null
  orbitTo: (target: Omit<OrbitTarget, 'requestedAt'>) => void
  clearOrbit: () => void
}

export const useLiveStore = create<LiveStore>((set) => ({
  mode: 'beginner', // discoverable by default; 'free' hides the console
  setMode: (mode) => set({ mode }),
  orbitTarget: null,
  orbitTo: (target) => set({ orbitTarget: { ...target, requestedAt: Date.now() } }),
  clearOrbit: () => set({ orbitTarget: null }),
}))
