'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CountryNewsArticle, CountryStrike, CountryStrikeMeta, WeatherNow } from '@/lib/api';
import { getCountryNews, getCountryStrikesResult, getWeatherNow } from '@/lib/api';
import type { LocalePage } from '@/lib/content/content-types';
import { boundsForLocale } from '@/lib/map/countryBounds';
import { flagEmoji } from '@/lib/live/owm';
import StrikeHistoryChart from '@/components/live/StrikeHistoryChart';

type LoadState = 'loading' | 'ready' | 'empty';

const NEWS_TERMS_BY_LANG: Record<string, string> = {
  cs: 'bouřka blesky',
  da: 'torden lyn',
  de: 'gewitter blitz',
  el: 'καταιγίδα κεραυνοί',
  en: 'lightning thunderstorm',
  es: 'rayos tormenta',
  et: 'äike välk',
  fi: 'ukkonen salama',
  fr: 'orage foudre',
  hr: 'nevrijeme munje',
  it: 'temporali fulmini',
  lt: 'audra žaibai',
  lv: 'negaiss zibens',
  nb: 'tordenvær lyn',
  nl: 'onweer bliksem',
  pl: 'burza pioruny',
  ro: 'furtună fulgere',
  sk: 'búrka blesky',
  sr: 'oluja munje',
  sv: 'åska blixt',
};

function localCountryName(page: LocalePage): string {
  const lang = page.hreflang.split('-')[0].toLowerCase();
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(page.locale.toUpperCase()) ?? page.country;
  } catch {
    return page.country;
  }
}

function newsQueryFor(page: LocalePage): string {
  const lang = page.hreflang.split('-')[0].toLowerCase();
  const terms = NEWS_TERMS_BY_LANG[lang] ?? page.leadSecondary?.term ?? page.primaryKeyword;
  return `${terms} ${localCountryName(page)}`;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function formatPublished(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(ts);
}

function cleanTitle(article: CountryNewsArticle): string {
  const suffix = article.source ? ` - ${article.source}` : '';
  return suffix && article.title.endsWith(suffix)
    ? article.title.slice(0, -suffix.length)
    : article.title;
}

function statLabel(perMin: number): string {
  if (perMin >= 20) return 'Very active';
  if (perMin >= 5) return 'Active';
  if (perMin >= 1) return 'Light activity';
  return 'Calm';
}

export default function CountryLiveSeoCard({ page }: { page: LocalePage }) {
  const [state, setState] = useState<LoadState>('loading');
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [strikeMeta, setStrikeMeta] = useState<CountryStrikeMeta | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [articles, setArticles] = useState<CountryNewsArticle[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const bounds = useMemo(() => boundsForLocale(page.locale), [page.locale]);
  const center = useMemo(
    () => ({
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lon: (bounds.minLon + bounds.maxLon) / 2,
    }),
    [bounds],
  );

  useEffect(() => {
    let alive = true;

    Promise.allSettled([
      getCountryStrikesResult(page.locale, 5000),
      getWeatherNow(center.lat, center.lon),
      getCountryNews({
        country: page.locale,
        lang: page.hreflang.toLowerCase(),
        query: newsQueryFor(page),
        limit: 5,
      }),
    ]).then(([strikeResult, weatherResult, newsResult]) => {
      if (!alive) return;

      const nextStrikeResult = strikeResult.status === 'fulfilled' ? strikeResult.value : null;
      const nextStrikes = nextStrikeResult?.strikes ?? [];
      setStrikes(nextStrikes);
      setStrikeMeta(nextStrikeResult?.meta ?? null);
      setWeather(weatherResult.status === 'fulfilled' ? weatherResult.value : null);
      setArticles(newsResult.status === 'fulfilled' ? newsResult.value.articles : []);
      setState(nextStrikes.length || weatherResult.status === 'fulfilled' || newsResult.status === 'fulfilled' ? 'ready' : 'empty');
    });

    return () => {
      alive = false;
    };
  }, [center.lat, center.lon, page]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    if (!strikes.length) return null;
    const times = strikes.map((s) => Date.parse(s.received_at)).filter(Number.isFinite);
    if (!times.length) return null;

    const newest = Math.max(...times);
    const oldest = Math.min(...times);
    const lastHour = times.filter((t) => now - t <= 3_600_000).length;
    const spanMin = Math.max(1, Math.round((newest - oldest) / 60_000));
    const perMin = Math.round((strikes.length / spanMin) * 10) / 10;

    return {
      lastHour,
      perMin,
      lastStrike: ago(now - newest),
      label: statLabel(perMin),
    };
  }, [strikes, now]);

  if (state === 'empty') return null;

  const lastHourLabel = strikeMeta?.cappedLastHour
    ? `> ${strikeMeta.limit.toLocaleString()}`
    : (strikeMeta?.lastHour ?? stats?.lastHour ?? 0).toLocaleString();

  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl">
      <div className="border-b border-white/10 bg-linear-to-r from-bolt/10 via-white/[0.03] to-electric/10 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-bolt/80">
              Live in {page.country}
            </p>
            <h2 className="font-display mt-1 text-xl font-bold">
              {flagEmoji(page.locale)} Lightning activity right now
            </h2>
          </div>
          {stats && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
              {stats.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {state === 'loading' && (
            <div className="grid gap-2 sm:grid-cols-3">
              {['Last hour', 'Last strike', 'Weather'].map((label) => (
                <div key={label} className="h-20 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          )}

          {state !== 'loading' && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniStat value={lastHourLabel} label="strikes · last hour" highlight />
                <MiniStat value={stats?.lastStrike ?? '—'} label="latest detected strike" />
                <MiniStat
                  value={weather ? `${weather.tempC}°C` : '—'}
                  label={weather ? `${weather.main} · ${weather.clouds}% clouds` : 'weather unavailable'}
                />
              </div>

              {strikes.length > 2 && <StrikeHistoryChart rows={strikes} now={now} />}
            </>
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <h3 className="font-display text-sm font-bold">Latest local lightning news</h3>
          {articles.length ? (
            <div className="mt-3 space-y-3">
              {articles.slice(0, 5).map((article) => (
                <a
                  key={article.url}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl p-2.5 transition hover:bg-white/5"
                >
                  <span className="line-clamp-2 text-sm font-medium text-white/85">{cleanTitle(article)}</span>
                  <span className="mt-1 block text-[11px] text-white/40">
                    {[article.source, formatPublished(article.publishedAt)].filter(Boolean).join(' · ')}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Local lightning headlines will appear here when the news feed has fresh results.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function MiniStat({
  value,
  label,
  highlight = false,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className={`font-display text-2xl font-extrabold tabular-nums ${highlight ? 'text-bolt' : 'text-white/90'}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}
