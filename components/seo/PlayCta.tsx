'use client'
// components/seo/PlayCta.tsx — CTA dans la copie SEO. Il n'y a plus de route
// /play : le jeu vit en mode Game sur le globe, donc ce bouton ferme le panneau
// de texte et bascule la console en mode Game (sur le pays de la page, qui reste
// sélectionné).
import { useLiveStore } from '@/store/liveStore'

export default function PlayCta({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const setMode = useLiveStore((s) => s.setMode)
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen)

  return (
    <button
      type="button"
      onClick={() => {
        setMode('game')
        setSeoContentOpen(false)
      }}
      className={className}
    >
      {children}
    </button>
  )
}