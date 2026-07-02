'use client'
// components/Nav/PlayButton.tsx — enters Game mode on the landing globe.
// On the landing page it just flips the mode switch; elsewhere it navigates
// home first, then the GlobeExperience picks up the game mode from the store.
import { useRouter, usePathname } from 'next/navigation'
import { useLiveStore } from '@/store/liveStore'
import posthog from 'posthog-js'

export default function PlayButton() {
  const router = useRouter()
  const pathname = usePathname()
  const setMode = useLiveStore((s) => s.setMode)
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen)

  const onPlay = () => {
    setMode('game')
    setSeoContentOpen(false) // in case the SEO text pane is open over the globe
    if (pathname !== '/') router.push('/')
    posthog.capture('game_entered', { from_path: pathname })
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="btn-glow ml-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold sm:ml-2 sm:px-4 sm:text-sm"
    >
      Play
    </button>
  )
}
