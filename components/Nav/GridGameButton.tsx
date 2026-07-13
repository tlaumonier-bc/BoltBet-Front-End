'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/ui'

export default function GridGameButton() {
  const { t } = useT()

  return (
    <Link
      href="/grid-game"
      aria-label={t('nav.gridGame')}
      className="ml-2 hidden items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-3.5 py-1.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/35 hover:bg-cyan-200/15 md:flex"
    >
      <span>{t('nav.gridGame')}</span>
    </Link>
  )
}
