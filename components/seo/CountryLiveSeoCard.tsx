'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountryNewsArticle, CountryStrike, CountryStrikeMeta, WeatherNow } from '@/lib/api';
import { getCountryNews, getCountryStrikesResult, getWeatherNow } from '@/lib/api';
import type { LocalePage } from '@/lib/content/content-types';
import { boundsForLocale } from '@/lib/map/countryBounds';
import { flagEmoji } from '@/lib/live/owm';
import StrikeHistoryChart from '@/components/live/StrikeHistoryChart';
import { useUiLanguage } from '@/lib/i18n/ui';

type LoadState = 'loading' | 'ready' | 'empty';

type LiveCopy = {
  liveIn: (country: string) => string;
  activityNow: string;
  lastHour: string;
  latestStrike: string;
  weatherUnavailable: string;
  weatherClouds: (main: string, clouds: number) => string;
  strikeHistory: string;
  eachBar: string;
  now: string;
  strikeHistoryAria: (total: number) => string;
  latestNews: string;
  noNews: string;
  status: {
    veryActive: string;
    active: string;
    light: string;
    calm: string;
  };
  ago: (value: number, unit: 's' | 'm' | 'h') => string;
};

const LIVE_COPY: Record<string, LiveCopy> = {
  cs: {
    liveIn: (country) => `Živě v ${country}`,
    activityNow: 'Blesková aktivita právě teď',
    lastHour: 'blesky · poslední hodina',
    latestStrike: 'poslední zjištěný blesk',
    weatherUnavailable: 'počasí není dostupné',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% oblačnost`,
    strikeHistory: 'Historie blesků',
    eachBar: 'každý sloupec',
    now: 'teď',
    strikeHistoryAria: (total) => `Počet blesků v čase pro posledních ${total} blesků`,
    latestNews: 'Nejnovější místní zprávy o bouřkách',
    noNews: 'Místní zprávy o blescích se zobrazí, až bude mít zdroj nové výsledky.',
    status: { veryActive: 'Velmi aktivní', active: 'Aktivní', light: 'Slabá aktivita', calm: 'Klid' },
    ago: (value, unit) => `před ${value}${unit}`,
  },
  da: {
    liveIn: (country) => `Live i ${country}`,
    activityNow: 'Lynaktivitet lige nu',
    lastHour: 'lyn · seneste time',
    latestStrike: 'seneste registrerede lyn',
    weatherUnavailable: 'vejr ikke tilgængeligt',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% skyer`,
    strikeHistory: 'Lynhistorik',
    eachBar: 'hver søjle',
    now: 'nu',
    strikeHistoryAria: (total) => `Lyntælling over tid for de seneste ${total} lyn`,
    latestNews: 'Seneste lokale lynnyheder',
    noNews: 'Lokale lynnyheder vises her, når nyhedsfeedet har friske resultater.',
    status: { veryActive: 'Meget aktiv', active: 'Aktiv', light: 'Let aktivitet', calm: 'Rolig' },
    ago: (value, unit) => `${value}${unit} siden`,
  },
  de: {
    liveIn: (country) => `Live in ${country}`,
    activityNow: 'Blitzaktivität jetzt',
    lastHour: 'Blitze · letzte Stunde',
    latestStrike: 'letzter erkannter Blitz',
    weatherUnavailable: 'Wetter nicht verfügbar',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% Wolken`,
    strikeHistory: 'Blitzverlauf',
    eachBar: 'jeder Balken',
    now: 'jetzt',
    strikeHistoryAria: (total) => `Blitzzahl im Zeitverlauf für die letzten ${total} Blitze`,
    latestNews: 'Neueste lokale Blitz-News',
    noNews: 'Lokale Blitzmeldungen erscheinen hier, sobald der News-Feed neue Ergebnisse hat.',
    status: { veryActive: 'Sehr aktiv', active: 'Aktiv', light: 'Leichte Aktivität', calm: 'Ruhig' },
    ago: (value, unit) => `vor ${value}${unit}`,
  },
  el: {
    liveIn: (country) => `Ζωντανά σε ${country}`,
    activityNow: 'Δραστηριότητα κεραυνών τώρα',
    lastHour: 'κεραυνοί · τελευταία ώρα',
    latestStrike: 'τελευταίος ανιχνευμένος κεραυνός',
    weatherUnavailable: 'ο καιρός δεν είναι διαθέσιμος',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% σύννεφα`,
    strikeHistory: 'Ιστορικό κεραυνών',
    eachBar: 'κάθε μπάρα',
    now: 'τώρα',
    strikeHistoryAria: (total) => `Πλήθος κεραυνών στον χρόνο για τους τελευταίους ${total} κεραυνούς`,
    latestNews: 'Τελευταίες τοπικές ειδήσεις για κεραυνούς',
    noNews: 'Οι τοπικές ειδήσεις για κεραυνούς θα εμφανιστούν εδώ όταν υπάρχουν νέα αποτελέσματα.',
    status: { veryActive: 'Πολύ ενεργό', active: 'Ενεργό', light: 'Ήπια δραστηριότητα', calm: 'Ήρεμα' },
    ago: (value, unit) => `πριν ${value}${unit}`,
  },
  en: {
    liveIn: (country) => `Live in ${country}`,
    activityNow: 'Lightning activity right now',
    lastHour: 'strikes · last hour',
    latestStrike: 'latest detected strike',
    weatherUnavailable: 'weather unavailable',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% clouds`,
    strikeHistory: 'Strike history',
    eachBar: 'each bar',
    now: 'now',
    strikeHistoryAria: (total) => `Strike count over time for the latest ${total} strikes`,
    latestNews: 'Latest local lightning news',
    noNews: 'Local lightning headlines will appear here when the news feed has fresh results.',
    status: { veryActive: 'Very active', active: 'Active', light: 'Light activity', calm: 'Calm' },
    ago: (value, unit) => `${value}${unit} ago`,
  },
  es: {
    liveIn: (country) => `En vivo en ${country}`,
    activityNow: 'Actividad de rayos ahora',
    lastHour: 'rayos · última hora',
    latestStrike: 'último rayo detectado',
    weatherUnavailable: 'tiempo no disponible',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% nubes`,
    strikeHistory: 'Historial de rayos',
    eachBar: 'cada barra',
    now: 'ahora',
    strikeHistoryAria: (total) => `Recuento de rayos en el tiempo para los últimos ${total} rayos`,
    latestNews: 'Últimas noticias locales sobre rayos',
    noNews: 'Las noticias locales sobre rayos aparecerán aquí cuando haya resultados recientes.',
    status: { veryActive: 'Muy activo', active: 'Activo', light: 'Actividad baja', calm: 'Calma' },
    ago: (value, unit) => `hace ${value}${unit}`,
  },
  et: {
    liveIn: (country) => `Otse: ${country}`,
    activityNow: 'Välguaktiivsus praegu',
    lastHour: 'välku · viimane tund',
    latestStrike: 'viimane tuvastatud välk',
    weatherUnavailable: 'ilm pole saadaval',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% pilvi`,
    strikeHistory: 'Välkude ajalugu',
    eachBar: 'iga tulp',
    now: 'praegu',
    strikeHistoryAria: (total) => `Välkude arv ajas viimase ${total} välgu kohta`,
    latestNews: 'Viimased kohalikud äikeseuudised',
    noNews: 'Kohalikud äikeseuudised ilmuvad siia, kui uudistevoos on värskeid tulemusi.',
    status: { veryActive: 'Väga aktiivne', active: 'Aktiivne', light: 'Kerge aktiivsus', calm: 'Rahulik' },
    ago: (value, unit) => `${value}${unit} tagasi`,
  },
  fi: {
    liveIn: (country) => `Live: ${country}`,
    activityNow: 'Salama-aktiivisuus juuri nyt',
    lastHour: 'salamaa · viime tunti',
    latestStrike: 'viimeisin havaittu salama',
    weatherUnavailable: 'sää ei saatavilla',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% pilviä`,
    strikeHistory: 'Salamahistoria',
    eachBar: 'jokainen palkki',
    now: 'nyt',
    strikeHistoryAria: (total) => `Salamien määrä ajan kuluessa viimeisille ${total} salamalle`,
    latestNews: 'Uusimmat paikalliset salamauutiset',
    noNews: 'Paikalliset salamauutiset näkyvät täällä, kun uutisvirrassa on tuoreita tuloksia.',
    status: { veryActive: 'Erittäin aktiivinen', active: 'Aktiivinen', light: 'Vähäistä aktiivisuutta', calm: 'Rauhallinen' },
    ago: (value, unit) => `${value}${unit} sitten`,
  },
  fr: {
    liveIn: (country) => `En direct en ${country}`,
    activityNow: 'Activité de foudre maintenant',
    lastHour: 'impacts · dernière heure',
    latestStrike: 'dernier impact détecté',
    weatherUnavailable: 'météo indisponible',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% nuages`,
    strikeHistory: 'Historique des impacts',
    eachBar: 'chaque barre',
    now: 'maintenant',
    strikeHistoryAria: (total) => `Nombre d'impacts dans le temps pour les ${total} derniers impacts`,
    latestNews: 'Dernières actualités locales sur la foudre',
    noNews: 'Les actualités locales sur la foudre apparaîtront ici dès que le flux aura des résultats récents.',
    status: { veryActive: 'Très actif', active: 'Actif', light: 'Activité faible', calm: 'Calme' },
    ago: (value, unit) => `il y a ${value}${unit}`,
  },
  hr: {
    liveIn: (country) => `Uživo u ${country}`,
    activityNow: 'Aktivnost munja upravo sada',
    lastHour: 'munja · zadnji sat',
    latestStrike: 'posljednja otkrivena munja',
    weatherUnavailable: 'vrijeme nije dostupno',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% oblaka`,
    strikeHistory: 'Povijest munja',
    eachBar: 'svaki stupac',
    now: 'sada',
    strikeHistoryAria: (total) => `Broj munja kroz vrijeme za zadnjih ${total} munja`,
    latestNews: 'Najnovije lokalne vijesti o munjama',
    noNews: 'Lokalne vijesti o munjama pojavit će se ovdje kada feed ima svježe rezultate.',
    status: { veryActive: 'Vrlo aktivno', active: 'Aktivno', light: 'Slaba aktivnost', calm: 'Mirno' },
    ago: (value, unit) => `prije ${value}${unit}`,
  },
  it: {
    liveIn: (country) => `Live in ${country}`,
    activityNow: 'Attività dei fulmini ora',
    lastHour: 'fulmini · ultima ora',
    latestStrike: 'ultimo fulmine rilevato',
    weatherUnavailable: 'meteo non disponibile',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% nuvole`,
    strikeHistory: 'Storico dei fulmini',
    eachBar: 'ogni barra',
    now: 'ora',
    strikeHistoryAria: (total) => `Conteggio dei fulmini nel tempo per gli ultimi ${total} fulmini`,
    latestNews: 'Ultime notizie locali sui fulmini',
    noNews: 'Le notizie locali sui fulmini appariranno qui quando il feed avrà risultati recenti.',
    status: { veryActive: 'Molto attivo', active: 'Attivo', light: 'Attività leggera', calm: 'Calmo' },
    ago: (value, unit) => `${value}${unit} fa`,
  },
  lt: {
    liveIn: (country) => `Tiesiogiai: ${country}`,
    activityNow: 'Žaibų aktyvumas dabar',
    lastHour: 'žaibai · paskutinė valanda',
    latestStrike: 'paskutinis aptiktas žaibas',
    weatherUnavailable: 'orai nepasiekiami',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% debesų`,
    strikeHistory: 'Žaibų istorija',
    eachBar: 'kiekvienas stulpelis',
    now: 'dabar',
    strikeHistoryAria: (total) => `Žaibų skaičius laike pagal paskutinius ${total} žaibų`,
    latestNews: 'Naujausios vietos žinios apie žaibus',
    noNews: 'Vietos žinios apie žaibus bus rodomos čia, kai naujienų srautas turės naujų rezultatų.',
    status: { veryActive: 'Labai aktyvu', active: 'Aktyvu', light: 'Silpnas aktyvumas', calm: 'Ramu' },
    ago: (value, unit) => `prieš ${value}${unit}`,
  },
  lv: {
    liveIn: (country) => `Tiešraidē: ${country}`,
    activityNow: 'Zibens aktivitāte pašlaik',
    lastHour: 'zibeņi · pēdējā stunda',
    latestStrike: 'pēdējais noteiktais zibens',
    weatherUnavailable: 'laikapstākļi nav pieejami',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% mākoņu`,
    strikeHistory: 'Zibens vēsture',
    eachBar: 'katra josla',
    now: 'tagad',
    strikeHistoryAria: (total) => `Zibens skaits laikā pēdējiem ${total} zibeņiem`,
    latestNews: 'Jaunākās vietējās ziņas par zibeni',
    noNews: 'Vietējās ziņas par zibeni parādīsies šeit, kad ziņu plūsmā būs svaigi rezultāti.',
    status: { veryActive: 'Ļoti aktīvs', active: 'Aktīvs', light: 'Vāja aktivitāte', calm: 'Mierīgs' },
    ago: (value, unit) => `pirms ${value}${unit}`,
  },
  nb: {
    liveIn: (country) => `Live i ${country}`,
    activityNow: 'Lynaktivitet akkurat nå',
    lastHour: 'lyn · siste time',
    latestStrike: 'siste registrerte lyn',
    weatherUnavailable: 'vær utilgjengelig',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% skyer`,
    strikeHistory: 'Lynhistorikk',
    eachBar: 'hver stolpe',
    now: 'nå',
    strikeHistoryAria: (total) => `Lyntelling over tid for de siste ${total} lynene`,
    latestNews: 'Siste lokale lynnyheter',
    noNews: 'Lokale lynnyheter vises her når nyhetsfeeden har ferske resultater.',
    status: { veryActive: 'Svært aktiv', active: 'Aktiv', light: 'Lett aktivitet', calm: 'Rolig' },
    ago: (value, unit) => `${value}${unit} siden`,
  },
  nl: {
    liveIn: (country) => `Live in ${country}`,
    activityNow: 'Bliksemactiviteit nu',
    lastHour: 'inslagen · laatste uur',
    latestStrike: 'laatste gedetecteerde inslag',
    weatherUnavailable: 'weer niet beschikbaar',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% bewolking`,
    strikeHistory: 'Bliksemgeschiedenis',
    eachBar: 'elke balk',
    now: 'nu',
    strikeHistoryAria: (total) => `Aantal blikseminslagen in de tijd voor de laatste ${total} inslagen`,
    latestNews: 'Laatste lokale bliksemnieuws',
    noNews: 'Lokaal bliksemnieuws verschijnt hier zodra de nieuwsfeed nieuwe resultaten heeft.',
    status: { veryActive: 'Zeer actief', active: 'Actief', light: 'Lichte activiteit', calm: 'Rustig' },
    ago: (value, unit) => `${value}${unit} geleden`,
  },
  pl: {
    liveIn: (country) => `Na żywo w ${country}`,
    activityNow: 'Aktywność piorunów teraz',
    lastHour: 'pioruny · ostatnia godzina',
    latestStrike: 'ostatni wykryty piorun',
    weatherUnavailable: 'pogoda niedostępna',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% chmur`,
    strikeHistory: 'Historia piorunów',
    eachBar: 'każdy słupek',
    now: 'teraz',
    strikeHistoryAria: (total) => `Liczba piorunów w czasie dla ostatnich ${total} piorunów`,
    latestNews: 'Najnowsze lokalne wiadomości o burzach',
    noNews: 'Lokalne wiadomości o piorunach pojawią się tutaj, gdy kanał będzie mieć świeże wyniki.',
    status: { veryActive: 'Bardzo aktywne', active: 'Aktywne', light: 'Lekka aktywność', calm: 'Spokojnie' },
    ago: (value, unit) => `${value}${unit} temu`,
  },
  ro: {
    liveIn: (country) => `Live în ${country}`,
    activityNow: 'Activitatea fulgerelor acum',
    lastHour: 'fulgere · ultima oră',
    latestStrike: 'ultimul fulger detectat',
    weatherUnavailable: 'vreme indisponibilă',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% nori`,
    strikeHistory: 'Istoricul fulgerelor',
    eachBar: 'fiecare bară',
    now: 'acum',
    strikeHistoryAria: (total) => `Numărul de fulgere în timp pentru ultimele ${total} fulgere`,
    latestNews: 'Cele mai noi știri locale despre fulgere',
    noNews: 'Știrile locale despre fulgere vor apărea aici când fluxul are rezultate proaspete.',
    status: { veryActive: 'Foarte activ', active: 'Activ', light: 'Activitate redusă', calm: 'Calm' },
    ago: (value, unit) => `acum ${value}${unit}`,
  },
  sk: {
    liveIn: (country) => `Naživo v ${country}`,
    activityNow: 'Aktivita bleskov práve teraz',
    lastHour: 'blesky · posledná hodina',
    latestStrike: 'posledný zistený blesk',
    weatherUnavailable: 'počasie nedostupné',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% oblačnosť`,
    strikeHistory: 'História bleskov',
    eachBar: 'každý stĺpec',
    now: 'teraz',
    strikeHistoryAria: (total) => `Počet bleskov v čase za posledných ${total} bleskov`,
    latestNews: 'Najnovšie miestne správy o búrkach',
    noNews: 'Miestne správy o bleskoch sa zobrazia, keď bude mať feed čerstvé výsledky.',
    status: { veryActive: 'Veľmi aktívne', active: 'Aktívne', light: 'Slabá aktivita', calm: 'Pokoj' },
    ago: (value, unit) => `pred ${value}${unit}`,
  },
  sr: {
    liveIn: (country) => `Uživo u ${country}`,
    activityNow: 'Aktivnost munja trenutno',
    lastHour: 'munja · poslednji sat',
    latestStrike: 'poslednja otkrivena munja',
    weatherUnavailable: 'vreme nije dostupno',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% oblaka`,
    strikeHistory: 'Istorija munja',
    eachBar: 'svaka traka',
    now: 'sada',
    strikeHistoryAria: (total) => `Broj munja kroz vreme za poslednjih ${total} munja`,
    latestNews: 'Najnovije lokalne vesti o munjama',
    noNews: 'Lokalne vesti o munjama pojaviće se ovde kada feed ima sveže rezultate.',
    status: { veryActive: 'Veoma aktivno', active: 'Aktivno', light: 'Slaba aktivnost', calm: 'Mirno' },
    ago: (value, unit) => `pre ${value}${unit}`,
  },
  sv: {
    liveIn: (country) => `Live i ${country}`,
    activityNow: 'Blixtaktivitet just nu',
    lastHour: 'blixtar · senaste timmen',
    latestStrike: 'senast upptäckta blixt',
    weatherUnavailable: 'väder ej tillgängligt',
    weatherClouds: (main, clouds) => `${main} · ${clouds}% moln`,
    strikeHistory: 'Blixt historik',
    eachBar: 'varje stapel',
    now: 'nu',
    strikeHistoryAria: (total) => `Antal blixtar över tid för de senaste ${total} blixtarna`,
    latestNews: 'Senaste lokala blixtnyheter',
    noNews: 'Lokala blixtnyheter visas här när nyhetsflödet har färska resultat.',
    status: { veryActive: 'Mycket aktivt', active: 'Aktivt', light: 'Låg aktivitet', calm: 'Lugnt' },
    ago: (value, unit) => `${value}${unit} sedan`,
  },
};

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

function ago(ms: number, copy: LiveCopy): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return copy.ago(s, 's');
  const m = Math.round(s / 60);
  if (m < 60) return copy.ago(m, 'm');
  return copy.ago(Math.round(m / 60), 'h');
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

function statLabel(perMin: number, copy: LiveCopy): string {
  if (perMin >= 20) return copy.status.veryActive;
  if (perMin >= 5) return copy.status.active;
  if (perMin >= 1) return copy.status.light;
  return copy.status.calm;
}

export default function CountryLiveSeoCard({ page }: { page: LocalePage }) {
  const [state, setState] = useState<LoadState>('loading');
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [strikeMeta, setStrikeMeta] = useState<CountryStrikeMeta | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [articles, setArticles] = useState<CountryNewsArticle[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [chartHeight, setChartHeight] = useState<number | null>(null);
  const statsBlockRef = useRef<HTMLDivElement | null>(null);
  const newsBlockRef = useRef<HTMLElement | null>(null);
  const { language } = useUiLanguage();

  const bounds = useMemo(() => boundsForLocale(page.locale), [page.locale]);
  const lang = language;
  const copy = LIVE_COPY[lang] ?? LIVE_COPY.en;
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
      getCountryStrikesResult(page.locale, 10000),
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

  useEffect(() => {
    const updateChartHeight = () => {
      if (window.innerWidth < 1024) {
        setChartHeight(null);
        return;
      }

      const newsHeight = newsBlockRef.current?.getBoundingClientRect().height ?? 0;
      const statsHeight = statsBlockRef.current?.getBoundingClientRect().height ?? 0;
      if (!newsHeight || !statsHeight) {
        setChartHeight(null);
        return;
      }

      const next = Math.max(120, Math.round(newsHeight - statsHeight));
      setChartHeight((current) => (current === next ? current : next));
    };

    updateChartHeight();
    const observer = new ResizeObserver(updateChartHeight);
    if (statsBlockRef.current) observer.observe(statsBlockRef.current);
    if (newsBlockRef.current) observer.observe(newsBlockRef.current);
    window.addEventListener('resize', updateChartHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateChartHeight);
    };
  }, [articles.length, state, strikes.length, weather]);

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
      lastStrike: ago(now - newest, copy),
      label: statLabel(perMin, copy),
    };
  }, [strikes, now, copy]);

  const lastHourLabel = strikeMeta?.cappedLastHour
    ? `> ${strikeMeta.limit.toLocaleString()}`
    : (strikeMeta?.lastHour ?? stats?.lastHour ?? 0).toLocaleString();

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl sm:mt-10">
      <div className="border-b border-white/10 bg-linear-to-r from-bolt/10 via-white/[0.03] to-electric/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bolt/80 sm:text-xs sm:tracking-[0.22em]">
              {copy.liveIn(localCountryName(page))}
            </p>
            <h2 className="font-display mt-1 text-lg font-bold sm:text-xl">
              {flagEmoji(page.locale)} {copy.activityNow}
            </h2>
          </div>
          {stats && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
              {stats.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid items-stretch gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[220px] flex-col">
          {state === 'loading' && (
            <div className="grid gap-2 sm:grid-cols-3">
              {[copy.lastHour, copy.latestStrike, copy.weatherUnavailable].map((label) => (
                <div key={label} className="h-20 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          )}

          {state !== 'loading' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={statsBlockRef} className="grid gap-2 sm:grid-cols-3">
                <MiniStat value={lastHourLabel} label={copy.lastHour} highlight />
                <MiniStat value={stats?.lastStrike ?? '—'} label={copy.latestStrike} />
                <MiniStat
                  value={weather ? `${weather.tempC}°C` : '—'}
                  label={weather ? copy.weatherClouds(weather.main, weather.clouds) : copy.weatherUnavailable}
                />
              </div>

              {strikes.length > 2 && (
                <div
                  className={chartHeight ? 'flex min-h-0 flex-col' : 'flex min-h-[120px] flex-1 flex-col'}
                  style={chartHeight ? { height: chartHeight } : undefined}
                >
                  <StrikeHistoryChart
                    rows={strikes}
                    now={now}
                    title={copy.strikeHistory}
                    barLabel={copy.eachBar}
                    nowLabel={copy.now}
                    ariaLabel={copy.strikeHistoryAria}
                    fill
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <aside ref={newsBlockRef} className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <h3 className="font-display text-sm font-bold">{copy.latestNews}</h3>
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
              {copy.noNews}
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:px-4 sm:py-3">
      <div className={`font-display text-xl font-extrabold tabular-nums sm:text-2xl ${highlight ? 'text-bolt' : 'text-white/90'}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}
