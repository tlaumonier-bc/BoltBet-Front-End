'use client'
// components/Nav/PlayButton.tsx — the primary "Play" CTA. The game is now the
// Grid Game at /grid-game (the old on-globe up/down mode was removed).
import { useRouter, usePathname } from 'next/navigation'
import posthog from 'posthog-js'

export default function PlayButton() {
  const router = useRouter()
  const pathname = usePathname()

  const onPlay = () => {
    posthog.capture('grid_game_entered', { from_path: pathname })
    router.push('/grid-game')
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="btn-glow ml-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold sm:ml-2 sm:px-4 sm:text-sm"
    >
      Play Grid Game
    </button>
  )
}
