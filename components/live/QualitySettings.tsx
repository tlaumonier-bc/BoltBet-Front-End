'use client'
// components/live/QualitySettings.tsx — graphics-quality dropdown (gear menu).
import { useState } from 'react'
import { useLiveStore } from '@/store/liveStore'
import type { GlobeQuality } from '@/lib/globe/quality'
import { GearIcon } from './hudShared'

const QUALITY_OPTIONS: { id: GlobeQuality; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

export default function QualitySettings() {
  const quality = useLiveStore((s) => s.quality)
  const setQuality = useLiveStore((s) => s.setQuality)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Graphics quality"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <GearIcon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{quality}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded-lg border border-white/10 bg-storm/95 p-1 shadow-xl backdrop-blur">
            <p className="px-2 py-1 text-[9px] uppercase tracking-wider text-white/35">Graphics</p>
            {QUALITY_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setQuality(o.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
                  quality === o.id
                    ? 'bg-electric/15 text-electric'
                    : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {o.label}
                {quality === o.id && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}