'use client'
// components/live/ModeBar.tsx — Day/Night imagery toggle + Free/Beginner/Pro/Game switch.
import { useLiveStore, type LiveViewMode, type GlobeMapStyle } from '@/store/liveStore'
import { useT } from '@/lib/i18n/ui'

const MODES: { id: LiveViewMode; labelKey: string }[] = [
  { id: 'free', labelKey: 'live.free' },
  { id: 'beginner', labelKey: 'live.beginner' },
  { id: 'pro', labelKey: 'live.pro' },
  { id: 'game', labelKey: 'live.game' },
]

const MAP_STYLES: { id: GlobeMapStyle; labelKey: string }[] = [
  { id: 'day', labelKey: 'live.day' },
  { id: 'night', labelKey: 'live.night' },
]

export default function ModeBar({ showModeSwitch = true }: { showModeSwitch?: boolean }) {
  const mode = useLiveStore((s) => s.mode)
  const setMode = useLiveStore((s) => s.setMode)
  const mapStyle = useLiveStore((s) => s.mapStyle)
  const setMapStyle = useLiveStore((s) => s.setMapStyle)
  const { t } = useT()

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
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      {showModeSwitch && (
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
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      )}
    </>
  )
}