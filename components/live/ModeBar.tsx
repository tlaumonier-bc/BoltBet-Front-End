'use client'
// components/live/ModeBar.tsx — Day/Night imagery toggle + Free/Beginner/Pro switch.
import { useLiveStore, type LiveViewMode, type GlobeMapStyle } from '@/store/liveStore'

const MODES: { id: LiveViewMode; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'pro', label: 'Pro' },
]

const MAP_STYLES: { id: GlobeMapStyle; label: string }[] = [
  { id: 'night', label: 'Night' },
  { id: 'day', label: 'Day' },
]

export default function ModeBar() {
  const mode = useLiveStore((s) => s.mode)
  const setMode = useLiveStore((s) => s.setMode)
  const mapStyle = useLiveStore((s) => s.mapStyle)
  const setMapStyle = useLiveStore((s) => s.setMapStyle)

  return (
    <>
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
    </>
  )
}