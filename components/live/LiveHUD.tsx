'use client'
// components/live/LiveHUD.tsx — the /live console shell.
// Left column: map-style + mode switch (always) + trimmed console.
// Right column: country panel when a country is selected, otherwise overall
//   globe stats (beginner/pro). lg+ screens only.
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro'} />}
      </div>

      {/* Right column — country info on click, else overall globe stats */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col lg:flex">
        {selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>
    </>
  )
}