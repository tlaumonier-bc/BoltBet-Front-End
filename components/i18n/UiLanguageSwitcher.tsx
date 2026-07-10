'use client';

import { useEffect, useRef, useState } from 'react';
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
};

export default function UiLanguageSwitcher({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useT();
  const current = UI_LANGUAGES.find((item) => item.code === language) ?? UI_LANGUAGES[0];

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
        className="grid size-8 place-items-center text-2xl leading-none transition hover:scale-110"
      >
        <span aria-hidden>{FLAGS[current.code]}</span>
      </button>

      {open && (
        <div className="glass-opaque absolute right-0 top-full mt-2 w-44 rounded-2xl p-2">
          {UI_LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLanguage(item.code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10 ${
                item.code === language ? 'bg-white/5 text-bolt' : 'text-white/80'
              }`}
            >
              <span aria-hidden>{FLAGS[item.code]}</span>
              <span className="flex-1">{item.nativeLabel}</span>
              {item.code === language && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
