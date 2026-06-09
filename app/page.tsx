import Link from 'next/link'
import GlobeWrapper from '@/components/Globe/GlobeWrapper'

export default function HomePage() {
  return (
    <main>
      <GlobeWrapper />

      {/* readability gradient over the globe */}
      <div className="pointer-events-none fixed inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(4,6,13,0.85)_85%)]" />

      <section className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center px-6 text-center">
        <span className="fade-up glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white/80" style={{ animationDelay: '0ms' }}>
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-bolt shadow-[0_0_10px_#fde047]" />
          LIVE · real-time strikes worldwide
        </span>

        <h1 className="fade-up font-display mt-6 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl" style={{ animationDelay: '120ms' }}>
          Predict where <span className="text-gradient">lightning</span> strikes next.
        </h1>

        <p className="fade-up mt-6 max-w-xl text-base text-white/65 sm:text-lg" style={{ animationDelay: '240ms' }}>
          A live 3D globe of real-time lightning. Pick a zone, place your call, and
          watch the bolts land in real time.
        </p>

        <div className="fade-up pointer-events-auto mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '360ms' }}>
          <Link href="/play" className="btn-glow rounded-full px-8 py-3.5 text-sm font-bold">
            Start playing →
          </Link>
          <Link
            href="/how-it-works"
            className="glass rounded-full px-8 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            How it works
          </Link>
        </div>

        <div className="fade-up mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center" style={{ animationDelay: '480ms' }}>
          {[
            ['162', 'live zones'],
            ['Real-time', 'lightning data'],
            ['Instant', 'credit payouts'],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="font-display text-2xl font-bold text-white">{big}</div>
              <div className="text-xs uppercase tracking-widest text-white/40">{small}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}