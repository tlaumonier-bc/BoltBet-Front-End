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

// Crossed-eye (eye-off): Free mode hides every panel, leaving only the globe.
// Sized at 1em so it matches the button text height and doesn't resize the button.
function FreeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1em] w-[1em] align-middle"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

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
              title={t(m.labelKey)}
              aria-label={t(m.labelKey)}
              className={`rounded-full px-3.5 py-1.5 transition ${
                mode === m.id
                  ? 'bg-bolt text-storm shadow-[0_0_14px_rgba(253,224,71,0.45)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {m.id === 'free' ? <FreeIcon /> : t(m.labelKey)}
            </button>
          ))}
        </div>
      )}
    </>
  )
}