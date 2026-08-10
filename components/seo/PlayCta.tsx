'use client'
// components/seo/PlayCta.tsx — CTA dans la copie SEO. Le jeu est désormais le
// Grid Game (/grid-game) ; ce bouton ferme le panneau de texte et y navigue.
import { useRouter } from 'next/navigation'
import { useLiveStore } from '@/store/liveStore'

export default function PlayCta({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen)

  return (
    <button
      type="button"
      onClick={() => {
        setSeoContentOpen(false)
        router.push('/grid-game')
      }}
      className={className}
    >
      {children}
    </button>
  )
}
