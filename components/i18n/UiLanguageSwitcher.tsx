'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { UI_LANGUAGES, useT, type UiLanguage } from '@/lib/i18n/ui';

const FLAGS: Record<UiLanguage, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  pl: '🇵🇱',
  nl: '🇳🇱',
  fi: '🇫🇮',
  et: '🇪🇪',
  sv: '🇸🇪',
  nb: '🇳🇴',
  cs: '🇨🇿',
  lv: '🇱🇻',
  hr: '🇭🇷',
  el: '🇬🇷',
  da: '🇩🇰',
  lt: '🇱🇹',
  sk: '🇸🇰',
  sr: '🇷🇸',
  ro: '🇷🇴',
  zh: '🇨🇳',
};

export default function UiLanguageSwitcher({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useT();
  const current = UI_LANGUAGES.find((item) => item.code === language) ?? UI_LANGUAGES[0];
  const languages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...UI_LANGUAGES]
      .sort((a, b) => a.label.localeCompare(b.label, 'en'))
      .filter((item) => {
        if (!needle) return true;
        return [item.label, item.nativeLabel, item.code].some((value) => value.toLowerCase().includes(needle));
      });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t('nav.language')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 px-1 text-[2rem] leading-none transition hover:scale-110"
      >
        <span aria-hidden>{FLAGS[current.code]}</span>
        <span aria-hidden className="relative -top-0.5 text-sm text-white/55">▾</span>
      </button>

      {open && (
        <div className="glass-opaque absolute right-0 top-full mt-2 w-64 rounded-2xl p-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search language"
            className="mb-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-bolt/60 focus:bg-white/12"
          />
          <div className="panel-scroll max-h-[600px] overflow-y-auto pr-1">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLanguage(item.code);
                  setOpen(false);
                  setQuery('');
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10 ${
                  item.code === language ? 'bg-white/5 text-bolt' : 'text-white/80'
                }`}
              >
                <span aria-hidden>{FLAGS[item.code]}</span>
                <span className="flex-1">
                  {item.label}
                  {item.nativeLabel !== item.label && <span className="text-white/45"> - {item.nativeLabel}</span>}
                </span>
                {item.code === language && <span aria-hidden>✓</span>}
              </button>
            ))}
            {!languages.length && (
              <div className="px-3 py-4 text-center text-sm text-white/45">No language found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
