'use client';
// components/i18n/LanguageSwitcher.tsx — pick the localized page for your language.
import { useEffect, useRef, useState } from 'react';
import { flagEmoji } from '@/lib/live/owm';
import type { LanguageAlternate } from '@/lib/content/content';

export default function LanguageSwitcher({ alternates }: { alternates: LanguageAlternate[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = alternates.find((a) => a.isCurrent);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (alternates.length < 2) return null; // nothing to switch to

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition hover:text-white"
      >
        <span className="text-sm leading-none" aria-hidden>
          {flagEmoji(current?.locale ?? '')}
        </span>
        {current?.country ?? 'Language'}
        <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="panel-scroll glass absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-56 overflow-y-auto rounded-2xl p-2">
            {alternates.map((a) => (
            <a key={a.hreflang} href={a.slug} hrefLang={a.hreflang} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/10 ${a.isCurrent ? 'bg-white/5' : ''}`}>
              <span className="text-base leading-none" aria-hidden>
                {flagEmoji(a.locale)}
              </span>
              <span className="flex-1">
                <span className="block font-medium text-white/90">{a.country}</span>
                <span className="block text-[11px] text-white/40">{a.language}</span>
              </span>
              {a.isCurrent && <span className="text-electric" aria-hidden>✓</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}