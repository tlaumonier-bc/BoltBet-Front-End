import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="fixed left-1/2 top-4 z-50 w-[min(960px,92vw)] -translate-x-1/2">
      <div className="glass flex items-center justify-between rounded-2xl px-5 py-3">
        <Link href="/" className="font-display text-base font-bold tracking-tight">
          <span className="text-bolt">⚡</span> BoltBet
        </Link>
        <div className="flex items-center gap-1 text-sm text-white/60">
          <Link href="/play" className="rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
            Play
          </Link>
          <Link href="/how-it-works" className="rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
            How it works
          </Link>
          <Link href="/leaderboard" className="rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
            Leaderboard
          </Link>
          <Link
            href="/play"
            className="btn-glow ml-2 rounded-lg px-4 py-1.5 text-sm font-semibold"
          >
            Launch
          </Link>
        </div>
      </div>
    </nav>
  )
}