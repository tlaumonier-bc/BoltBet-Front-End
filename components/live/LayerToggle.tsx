// components/live/LayerToggle.tsx
import type { GlobeLayerDef } from '@/lib/globe/layers'

export default function LayerToggle({
  def,
  active,
  onToggle,
}: {
  def: GlobeLayerDef
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={def.description}
      className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
        active
          ? 'border-electric/50 bg-electric/10'
          : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8'
      }`}
    >
      <span className="mt-0.5 w-4 shrink-0 text-center text-xs leading-4" aria-hidden>
        {def.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            active ? 'text-electric' : 'text-white/85'
          }`}
        >
          {def.label}
          {def.tier === 'pro' && (
            <span className="rounded bg-bolt/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-bolt">
              pro
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-white/40">
          {def.description}
        </span>
      </span>
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition ${
          active ? 'bg-electric/80' : 'bg-white/15'
        }`}
        aria-hidden
      >
        <span
          className={`h-3 w-3 rounded-full bg-storm transition-transform ${
            active ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}