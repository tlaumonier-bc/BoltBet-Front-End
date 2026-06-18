'use client'
// components/live/LiveHUD.tsx — the /live console shell.
// Left column: map-style + mode switch (always) + the console (Beginner / Pro).
//   In Pro mode the console now also contains what used to be the right panel.
// Right column: dedicated to the clicked-country panel (CountryPanel self-hides
//   when nothing is selected). lg+ screens only.
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro'} />}
      </div>

      {/* Right column — country info, shows on country click */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col lg:flex">
        <CountryPanel />
      </div>
    </>
  )
}