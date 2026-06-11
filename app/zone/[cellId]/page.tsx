import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Backdrop from '@/components/Backdrop/Backdrop'
import { allCells, parseCellId, cellCenter, regionName } from '@/lib/grid'

export function generateStaticParams() {
  return allCells().map((c) => ({ cellId: c.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: { cellId: string }
}): Promise<Metadata> {
  const parsed = parseCellId(params.cellId)
  if (!parsed) return { title: 'Zone not found' }
  const { lat, lon } = cellCenter(parsed.lonMin, parsed.latMin)
  const region = regionName(lat, lon)
  return {
    title: `Lightning Prediction: ${region} Zone`,
    description: `Live lightning strike statistics and predictions for the ${region} zone (around ${lat}°, ${lon}°). Track real-time bolts and place predictions on Lightning Map Bets.`,
    alternates: { canonical: `https://lightningmapgames.com/zone/${params.cellId}` },
    robots: { index: false, follow: true },
  }
}

export default function ZonePage({ params }: { params: { cellId: string } }) {
  const parsed = parseCellId(params.cellId)
  if (!parsed) notFound()
  const { lat, lon } = cellCenter(parsed.lonMin, parsed.latMin)
  const region = regionName(lat, lon)

  return (
    <main className="relative min-h-screen">
      <Backdrop />
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-32">
        <p className="text-xs uppercase tracking-[0.3em] text-electric/70">
          Lightning zone · {params.cellId}
        </p>
        <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
          {region} <span className="text-gradient">Lightning</span> Zone
        </h1>

        <p className="mt-5 text-white/65">
          This zone covers the area from {parsed.lonMin}° to {parsed.lonMin + 20}°
          longitude and {parsed.latMin}° to {parsed.latMin + 20}° latitude, centered
          near {lat}°, {lon}°. It is one of 162 prediction zones on the Lightning Map Bets live
          lightning globe.
        </p>

        <div className="glass mt-8 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">Lightning activity in {region}</h2>
          <p className="mt-3 text-white/65">
            Strike frequency in {region} drives this zone’s multiplier in real time. When
            storms are active, multipliers fall; during calm periods they rise. Open the
            live globe to see current bolts and place a prediction on this zone.
          </p>
        </div>

        <Link href="/play" className="btn-glow mt-8 inline-block rounded-full px-7 py-3 text-sm font-bold">
          Predict strikes in {region} →
        </Link>
      </div>
    </main>
  )
}