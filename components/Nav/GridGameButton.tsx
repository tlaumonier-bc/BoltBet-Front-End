'use client'

export default function GridGameButton() {
  return (
    <button
      type="button"
      disabled
      aria-label="Grid Game coming soon"
      className="ml-2 hidden cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm font-semibold text-white/45 opacity-70 md:flex"
    >
      <span>Grid Game</span>
      <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-100/60">
        Coming soon
      </span>
    </button>
  )
}
