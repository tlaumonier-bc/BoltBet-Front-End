'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type UiLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'pl'
  | 'nl'
  | 'fi'
  | 'et'
  | 'sv'
  | 'nb'
  | 'cs'
  | 'lv'
  | 'hr'
  | 'el'
  | 'da'
  | 'lt'
  | 'sk'
  | 'sr'
  | 'ro';

export const UI_LANGUAGES: { code: UiLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands' },
  { code: 'fi', label: 'Finnish', nativeLabel: 'Suomi' },
  { code: 'et', label: 'Estonian', nativeLabel: 'Eesti' },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska' },
  { code: 'nb', label: 'Norwegian', nativeLabel: 'Norsk' },
  { code: 'cs', label: 'Czech', nativeLabel: 'Čeština' },
  { code: 'lv', label: 'Latvian', nativeLabel: 'Latviešu' },
  { code: 'hr', label: 'Croatian', nativeLabel: 'Hrvatski' },
  { code: 'el', label: 'Greek', nativeLabel: 'Ελληνικά' },
  { code: 'da', label: 'Danish', nativeLabel: 'Dansk' },
  { code: 'lt', label: 'Lithuanian', nativeLabel: 'Lietuvių' },
  { code: 'sk', label: 'Slovak', nativeLabel: 'Slovenčina' },
  { code: 'sr', label: 'Serbian', nativeLabel: 'Srpski' },
  { code: 'ro', label: 'Romanian', nativeLabel: 'Română' },
];

const LANGUAGE_SET = new Set(UI_LANGUAGES.map((language) => language.code));
const STORAGE_KEY = 'lmg-ui-language';
const CHANGE_EVENT = 'lmg-ui-language-change';

interface CopyTree {
  [key: string]: string | CopyTree;
}

export const UI_COPY = {
  en: {
    nav: {
      byCountry: 'By country',
      howItWorks: 'How it works',
      leaderboard: 'Leaderboard',
      play: 'Play',
      playGame: 'Play the game',
      gridGame: 'Grid Game',
      comingSoon: 'Coming soon',
      menu: 'Open menu',
      language: 'Language',
    },
    live: {
      console: 'Live console',
      globeActivity: 'Globe activity',
      orbitTo: 'Orbit to',
      wholeGlobe: 'Whole globe',
      backToGlobe: 'Back to globe',
      nearMe: 'Near me',
      findingNearby: 'Finding nearby strikes…',
      nearbyStrikes: '{count} nearby strikes',
      layers: 'Layers',
      layersPro: 'Layers · Pro',
      free: 'Free',
      beginner: 'Beginner',
      pro: 'Pro',
      game: 'Game',
      day: 'Day',
      night: 'Night',
      good: 'good',
      medium: 'med',
      bad: 'bad',
      close: 'Close',
      preparingProfile: 'Preparing your game profile…',
    },
    countryPanel: {
      live: 'Live',
      idle: 'Idle',
      noStrikeData: 'No strike data',
      unavailable: 'Strike data isn’t available for this territory — it has no ISO country code.',
      loading: 'Loading recent strikes…',
      learnMore: 'Learn more about {country}',
      strikesLastHour: 'strikes · last hour',
      recentRate: 'recent rate',
      lastStrike: 'last strike',
      latest: 'Latest {count} strikes · {span} window',
      now: 'Now',
      secondsAgo: '{value}s ago',
      minutesAgo: '{value}m ago',
      hoursAgo: '{value}h ago',
      intensity: {
        intense: 'Intense',
        active: 'Active',
        moderate: 'Moderate',
        light: 'Light',
        calm: 'Calm',
      },
    },
    seo: {
      dataSource: 'Live strike data from the Blitzortung community detection network.',
      play: 'Play',
    },
    layers: {
      recent1h: 'Strikes · 1 h',
      recent1hDescription: 'Strikes from the last hour.',
      recent3h: 'Strikes · 3 h',
      recent3hDescription: 'Strikes 1 to 3 hours old.',
      recent6h: 'Strikes · 6 h',
      recent6hDescription: 'Strikes 3 to 6 hours old.',
      clouds: 'Clouds',
      cloudsDescription: 'Live cloud cover across the globe.',
      rain: 'Rain',
      rainDescription: 'Live rain, minute by minute.',
      temperature: 'Temperature',
      temperatureDescription: "The planet's heat, blue to red.",
      wind: 'Wind',
      windDescription: 'The air in motion, worldwide.',
    },
    gamePanel: {
      strikeGame: 'Strike game',
      notPlayable: 'Not playable',
      notPlayableBody: 'No strikes detected here in the last 30 seconds, so there is nothing to predict yet. Pick a country with live activity, or take on the whole globe.',
      findPlayableCountry: 'Find a playable country',
      or: 'or',
      playWholeGlobe: 'Play the whole globe',
      points: 'Points',
      nextTrophy: 'Next trophy',
      allTrophiesUnlocked: 'All trophies unlocked',
      leaderboard: 'Leaderboard',
      loadingRanking: 'Loading ranking...',
      activity: 'Activity',
      playAnytime: 'play anytime',
      secondsToResult: '{value}s to result',
      lastGames: 'Last 3 games',
    },
  },
  es: {
    nav: { byCountry: 'Por país', howItWorks: 'Cómo funciona', leaderboard: 'Clasificación', play: 'Jugar', playGame: 'Jugar', gridGame: 'Juego de cuadrícula', comingSoon: 'Próximamente', menu: 'Abrir menú', language: 'Idioma' },
    live: { console: 'Consola en vivo', globeActivity: 'Actividad global', orbitTo: 'Ir a', wholeGlobe: 'Globo completo', backToGlobe: 'Volver al globo', nearMe: 'Cerca de mí', findingNearby: 'Buscando rayos cercanos…', nearbyStrikes: '{count} rayos cercanos', layers: 'Capas', layersPro: 'Capas · Pro', free: 'Libre', beginner: 'Básico', pro: 'Pro', game: 'Juego', day: 'Día', night: 'Noche', good: 'bueno', medium: 'medio', bad: 'malo', close: 'Cerrar', preparingProfile: 'Preparando tu perfil…' },
    countryPanel: { live: 'En vivo', idle: 'En calma', noStrikeData: 'Sin datos de rayos', unavailable: 'Los datos no están disponibles para este territorio: no tiene código ISO de país.', loading: 'Cargando rayos recientes…', learnMore: 'Más información sobre {country}', strikesLastHour: 'rayos · última hora', recentRate: 'ritmo reciente', lastStrike: 'último rayo', latest: 'Últimos {count} rayos · ventana de {span}', now: 'Ahora', secondsAgo: 'hace {value}s', minutesAgo: 'hace {value}m', hoursAgo: 'hace {value}h', intensity: { intense: 'Intensa', active: 'Activa', moderate: 'Moderada', light: 'Ligera', calm: 'Tranquila' } },
    seo: { dataSource: 'Datos de rayos en vivo de la red comunitaria Blitzortung.', play: 'Jugar' },
    layers: { recent1h: 'Rayos · 1 h', recent1hDescription: 'Rayos de la última hora.', recent3h: 'Rayos · 3 h', recent3hDescription: 'Rayos de hace 1 a 3 horas.', recent6h: 'Rayos · 6 h', recent6hDescription: 'Rayos de hace 3 a 6 horas.', clouds: 'Nubes', cloudsDescription: 'Cobertura nubosa en vivo en todo el mundo.', rain: 'Lluvia', rainDescription: 'Lluvia en vivo, minuto a minuto.', temperature: 'Temperatura', temperatureDescription: 'Calor del planeta, de azul a rojo.', wind: 'Viento', windDescription: 'Aire en movimiento en todo el mundo.' },
    gamePanel: { strikeGame: 'Juego de rayos', notPlayable: 'No jugable', notPlayableBody: 'No se detectaron rayos aquí en los últimos 30 segundos. Elige un país con actividad en vivo o juega con todo el globo.', findPlayableCountry: 'Buscar un país jugable', or: 'o', playWholeGlobe: 'Jugar con todo el globo', points: 'Puntos', nextTrophy: 'Próximo trofeo', allTrophiesUnlocked: 'Todos los trofeos desbloqueados', leaderboard: 'Clasificación', loadingRanking: 'Cargando clasificación...', activity: 'Actividad', playAnytime: 'juega cuando quieras', secondsToResult: '{value}s para el resultado', lastGames: 'Últimas 3 partidas' },
  },
  fr: {
    nav: { byCountry: 'Par pays', howItWorks: 'Comment ça marche', leaderboard: 'Classement', play: 'Jouer', playGame: 'Jouer', gridGame: 'Jeu en grille', comingSoon: 'Bientôt', menu: 'Ouvrir le menu', language: 'Langue' },
    live: { console: 'Console live', globeActivity: 'Activité du globe', orbitTo: 'Aller vers', wholeGlobe: 'Globe entier', backToGlobe: 'Retour au globe', nearMe: 'Près de moi', findingNearby: 'Recherche des impacts proches…', nearbyStrikes: '{count} impacts proches', layers: 'Couches', layersPro: 'Couches · Pro', free: 'Libre', beginner: 'Débutant', pro: 'Pro', game: 'Jeu', day: 'Jour', night: 'Nuit', good: 'bon', medium: 'moyen', bad: 'mauvais', close: 'Fermer', preparingProfile: 'Préparation du profil…' },
    countryPanel: { live: 'Live', idle: 'Calme', noStrikeData: 'Pas de données foudre', unavailable: 'Les données ne sont pas disponibles pour ce territoire: il n’a pas de code pays ISO.', loading: 'Chargement des impacts récents…', learnMore: 'En savoir plus sur {country}', strikesLastHour: 'impacts · dernière heure', recentRate: 'rythme récent', lastStrike: 'dernier impact', latest: 'Derniers {count} impacts · fenêtre {span}', now: 'Maintenant', secondsAgo: 'il y a {value}s', minutesAgo: 'il y a {value}m', hoursAgo: 'il y a {value}h', intensity: { intense: 'Intense', active: 'Active', moderate: 'Modérée', light: 'Faible', calm: 'Calme' } },
    seo: { dataSource: 'Données foudre en direct du réseau communautaire Blitzortung.', play: 'Jouer' },
    layers: { recent1h: 'Impacts · 1 h', recent1hDescription: 'Impacts de la dernière heure.', recent3h: 'Impacts · 3 h', recent3hDescription: 'Impacts âgés de 1 à 3 heures.', recent6h: 'Impacts · 6 h', recent6hDescription: 'Impacts âgés de 3 à 6 heures.', clouds: 'Nuages', cloudsDescription: 'Couverture nuageuse en direct.', rain: 'Pluie', rainDescription: 'Pluie en direct, minute par minute.', temperature: 'Température', temperatureDescription: 'Chaleur de la planète, du bleu au rouge.', wind: 'Vent', windDescription: 'Air en mouvement dans le monde.' },
    gamePanel: { strikeGame: 'Jeu foudre', notPlayable: 'Non jouable', notPlayableBody: 'Aucun impact détecté ici dans les 30 dernières secondes. Choisissez un pays actif ou jouez sur le globe entier.', findPlayableCountry: 'Trouver un pays jouable', or: 'ou', playWholeGlobe: 'Jouer sur le globe entier', points: 'Points', nextTrophy: 'Prochain trophée', allTrophiesUnlocked: 'Tous les trophées débloqués', leaderboard: 'Classement', loadingRanking: 'Chargement du classement...', activity: 'Activité', playAnytime: 'jouer à tout moment', secondsToResult: '{value}s avant résultat', lastGames: '3 dernières parties' },
  },
  de: {
    nav: { byCountry: 'Nach Land', howItWorks: 'So funktioniert es', leaderboard: 'Rangliste', play: 'Spielen', playGame: 'Spielen', gridGame: 'Rasterspiel', comingSoon: 'Bald verfügbar', menu: 'Menü öffnen', language: 'Sprache' },
    live: { console: 'Live-Konsole', globeActivity: 'Globus-Aktivität', orbitTo: 'Springen zu', wholeGlobe: 'Ganzer Globus', backToGlobe: 'Zurück zum Globus', nearMe: 'In meiner Nähe', findingNearby: 'Suche Blitze in der Nähe…', nearbyStrikes: '{count} Blitze in der Nähe', layers: 'Ebenen', layersPro: 'Ebenen · Pro', free: 'Frei', beginner: 'Einsteiger', pro: 'Pro', game: 'Spiel', day: 'Tag', night: 'Nacht', good: 'gut', medium: 'mittel', bad: 'schlecht', close: 'Schließen', preparingProfile: 'Spielprofil wird vorbereitet…' },
    countryPanel: { live: 'Live', idle: 'Ruhig', noStrikeData: 'Keine Blitzdaten', unavailable: 'Für dieses Gebiet sind keine Daten verfügbar, da es keinen ISO-Ländercode hat.', loading: 'Aktuelle Blitze werden geladen…', learnMore: 'Mehr über {country}', strikesLastHour: 'Blitze · letzte Stunde', recentRate: 'aktuelle Rate', lastStrike: 'letzter Blitz', latest: 'Neueste {count} Blitze · Zeitraum {span}', now: 'Jetzt', secondsAgo: 'vor {value}s', minutesAgo: 'vor {value}m', hoursAgo: 'vor {value}h', intensity: { intense: 'Intensiv', active: 'Aktiv', moderate: 'Moderat', light: 'Leicht', calm: 'Ruhig' } },
    seo: { dataSource: 'Live-Blitzdaten aus dem Community-Erkennungsnetzwerk Blitzortung.', play: 'Spielen' },
    layers: { recent1h: 'Blitze · 1 h', recent1hDescription: 'Blitze der letzten Stunde.', recent3h: 'Blitze · 3 h', recent3hDescription: 'Blitze von vor 1 bis 3 Stunden.', recent6h: 'Blitze · 6 h', recent6hDescription: 'Blitze von vor 3 bis 6 Stunden.', clouds: 'Wolken', cloudsDescription: 'Live-Wolkenbedeckung weltweit.', rain: 'Regen', rainDescription: 'Live-Regen, Minute für Minute.', temperature: 'Temperatur', temperatureDescription: 'Planetare Wärme, blau bis rot.', wind: 'Wind', windDescription: 'Luft in Bewegung, weltweit.' },
    gamePanel: { strikeGame: 'Blitzspiel', notPlayable: 'Nicht spielbar', notPlayableBody: 'Hier wurden in den letzten 30 Sekunden keine Blitze erkannt. Wähle ein aktives Land oder spiele auf dem ganzen Globus.', findPlayableCountry: 'Spielbares Land finden', or: 'oder', playWholeGlobe: 'Ganzen Globus spielen', points: 'Punkte', nextTrophy: 'Nächste Trophäe', allTrophiesUnlocked: 'Alle Trophäen freigeschaltet', leaderboard: 'Rangliste', loadingRanking: 'Rangliste wird geladen...', activity: 'Aktivität', playAnytime: 'jederzeit spielen', secondsToResult: '{value}s bis Ergebnis', lastGames: 'Letzte 3 Spiele' },
  },
  it: {
    nav: { byCountry: 'Per paese', howItWorks: 'Come funziona', leaderboard: 'Classifica', play: 'Gioca', playGame: 'Gioca', gridGame: 'Gioco griglia', comingSoon: 'Prossimamente', menu: 'Apri menu', language: 'Lingua' },
    live: { console: 'Console live', globeActivity: 'Attività del globo', orbitTo: 'Vai a', wholeGlobe: 'Globo intero', backToGlobe: 'Torna al globo', nearMe: 'Vicino a me', findingNearby: 'Ricerca fulmini vicini…', nearbyStrikes: '{count} fulmini vicini', layers: 'Livelli', layersPro: 'Livelli · Pro', free: 'Libero', beginner: 'Principiante', pro: 'Pro', game: 'Gioco', day: 'Giorno', night: 'Notte', good: 'buono', medium: 'medio', bad: 'scarso', close: 'Chiudi', preparingProfile: 'Preparazione profilo…' },
    countryPanel: { live: 'Live', idle: 'Calmo', noStrikeData: 'Nessun dato sui fulmini', unavailable: 'I dati non sono disponibili per questo territorio: non ha un codice paese ISO.', loading: 'Caricamento fulmini recenti…', learnMore: 'Scopri di più su {country}', strikesLastHour: 'fulmini · ultima ora', recentRate: 'ritmo recente', lastStrike: 'ultimo fulmine', latest: 'Ultimi {count} fulmini · finestra {span}', now: 'Ora', secondsAgo: '{value}s fa', minutesAgo: '{value}m fa', hoursAgo: '{value}h fa', intensity: { intense: 'Intensa', active: 'Attiva', moderate: 'Moderata', light: 'Leggera', calm: 'Calma' } },
    seo: { dataSource: 'Dati sui fulmini in diretta dalla rete comunitaria Blitzortung.', play: 'Gioca' },
    layers: { recent1h: 'Fulmini · 1 h', recent1hDescription: 'Fulmini dell’ultima ora.', recent3h: 'Fulmini · 3 h', recent3hDescription: 'Fulmini da 1 a 3 ore fa.', recent6h: 'Fulmini · 6 h', recent6hDescription: 'Fulmini da 3 a 6 ore fa.', clouds: 'Nuvole', cloudsDescription: 'Copertura nuvolosa live nel mondo.', rain: 'Pioggia', rainDescription: 'Pioggia live, minuto per minuto.', temperature: 'Temperatura', temperatureDescription: 'Calore del pianeta, dal blu al rosso.', wind: 'Vento', windDescription: 'Aria in movimento nel mondo.' },
    gamePanel: { strikeGame: 'Gioco dei fulmini', notPlayable: 'Non giocabile', notPlayableBody: 'Qui non sono stati rilevati fulmini negli ultimi 30 secondi. Scegli un paese con attività live o gioca sul globo intero.', findPlayableCountry: 'Trova un paese giocabile', or: 'o', playWholeGlobe: 'Gioca sul globo intero', points: 'Punti', nextTrophy: 'Prossimo trofeo', allTrophiesUnlocked: 'Tutti i trofei sbloccati', leaderboard: 'Classifica', loadingRanking: 'Caricamento classifica...', activity: 'Attività', playAnytime: 'gioca quando vuoi', secondsToResult: '{value}s al risultato', lastGames: 'Ultime 3 partite' },
  },
  pt: {
    nav: { byCountry: 'Por país', howItWorks: 'Como funciona', leaderboard: 'Classificação', play: 'Jogar', playGame: 'Jogar', gridGame: 'Jogo em grelha', comingSoon: 'Em breve', menu: 'Abrir menu', language: 'Idioma' },
    live: { console: 'Consola ao vivo', globeActivity: 'Atividade do globo', orbitTo: 'Ir para', wholeGlobe: 'Globo inteiro', backToGlobe: 'Voltar ao globo', nearMe: 'Perto de mim', findingNearby: 'A procurar raios próximos…', nearbyStrikes: '{count} raios próximos', layers: 'Camadas', layersPro: 'Camadas · Pro', free: 'Livre', beginner: 'Iniciante', pro: 'Pro', game: 'Jogo', day: 'Dia', night: 'Noite', good: 'bom', medium: 'médio', bad: 'mau', close: 'Fechar', preparingProfile: 'A preparar o perfil…' },
    countryPanel: { live: 'Ao vivo', idle: 'Calmo', noStrikeData: 'Sem dados de raios', unavailable: 'Os dados não estão disponíveis para este território: não tem código ISO de país.', loading: 'A carregar raios recentes…', learnMore: 'Saber mais sobre {country}', strikesLastHour: 'raios · última hora', recentRate: 'ritmo recente', lastStrike: 'último raio', latest: 'Últimos {count} raios · janela {span}', now: 'Agora', secondsAgo: 'há {value}s', minutesAgo: 'há {value}m', hoursAgo: 'há {value}h', intensity: { intense: 'Intensa', active: 'Ativa', moderate: 'Moderada', light: 'Fraca', calm: 'Calma' } },
    seo: { dataSource: 'Dados de raios em direto da rede comunitária Blitzortung.', play: 'Jogar' },
    layers: { recent1h: 'Raios · 1 h', recent1hDescription: 'Raios da última hora.', recent3h: 'Raios · 3 h', recent3hDescription: 'Raios de 1 a 3 horas atrás.', recent6h: 'Raios · 6 h', recent6hDescription: 'Raios de 3 a 6 horas atrás.', clouds: 'Nuvens', cloudsDescription: 'Cobertura de nuvens em direto no mundo.', rain: 'Chuva', rainDescription: 'Chuva em direto, minuto a minuto.', temperature: 'Temperatura', temperatureDescription: 'Calor do planeta, de azul a vermelho.', wind: 'Vento', windDescription: 'Ar em movimento no mundo.' },
    gamePanel: { strikeGame: 'Jogo dos raios', notPlayable: 'Não jogável', notPlayableBody: 'Não foram detetados raios aqui nos últimos 30 segundos. Escolhe um país com atividade ao vivo ou joga no globo inteiro.', findPlayableCountry: 'Encontrar país jogável', or: 'ou', playWholeGlobe: 'Jogar no globo inteiro', points: 'Pontos', nextTrophy: 'Próximo troféu', allTrophiesUnlocked: 'Todos os troféus desbloqueados', leaderboard: 'Classificação', loadingRanking: 'A carregar classificação...', activity: 'Atividade', playAnytime: 'jogar a qualquer momento', secondsToResult: '{value}s até ao resultado', lastGames: 'Últimos 3 jogos' },
  },
  pl: {
    nav: { byCountry: 'Według kraju', howItWorks: 'Jak to działa', leaderboard: 'Ranking', play: 'Graj', playGame: 'Zagraj', gridGame: 'Gra siatkowa', comingSoon: 'Wkrótce', menu: 'Otwórz menu', language: 'Język' },
    live: { console: 'Konsola live', globeActivity: 'Aktywność globu', orbitTo: 'Przejdź do', wholeGlobe: 'Cały glob', backToGlobe: 'Powrót do globu', nearMe: 'Blisko mnie', findingNearby: 'Szukam pobliskich wyładowań…', nearbyStrikes: '{count} pobliskich wyładowań', layers: 'Warstwy', layersPro: 'Warstwy · Pro', free: 'Wolny', beginner: 'Początkujący', pro: 'Pro', game: 'Gra', day: 'Dzień', night: 'Noc', good: 'dobry', medium: 'średni', bad: 'zły', close: 'Zamknij', preparingProfile: 'Przygotowywanie profilu…' },
    countryPanel: { live: 'Na żywo', idle: 'Spokojnie', noStrikeData: 'Brak danych o wyładowaniach', unavailable: 'Dane nie są dostępne dla tego terytorium: brak kodu kraju ISO.', loading: 'Ładowanie ostatnich wyładowań…', learnMore: 'Dowiedz się więcej o {country}', strikesLastHour: 'wyładowania · ostatnia godzina', recentRate: 'ostatnie tempo', lastStrike: 'ostatnie wyładowanie', latest: 'Ostatnie {count} wyładowań · okno {span}', now: 'Teraz', secondsAgo: '{value}s temu', minutesAgo: '{value}m temu', hoursAgo: '{value}h temu', intensity: { intense: 'Intensywna', active: 'Aktywna', moderate: 'Umiarkowana', light: 'Lekka', calm: 'Spokojna' } },
    seo: { dataSource: 'Dane o wyładowaniach na żywo z sieci społecznościowej Blitzortung.', play: 'Graj' },
    layers: { recent1h: 'Wyładowania · 1 h', recent1hDescription: 'Wyładowania z ostatniej godziny.', recent3h: 'Wyładowania · 3 h', recent3hDescription: 'Wyładowania sprzed 1-3 godzin.', recent6h: 'Wyładowania · 6 h', recent6hDescription: 'Wyładowania sprzed 3-6 godzin.', clouds: 'Chmury', cloudsDescription: 'Zachmurzenie na żywo na świecie.', rain: 'Deszcz', rainDescription: 'Deszcz na żywo, minuta po minucie.', temperature: 'Temperatura', temperatureDescription: 'Ciepło planety, od niebieskiego do czerwonego.', wind: 'Wiatr', windDescription: 'Ruch powietrza na całym świecie.' },
    gamePanel: { strikeGame: 'Gra w wyładowania', notPlayable: 'Niegrywalne', notPlayableBody: 'Nie wykryto tu wyładowań w ostatnich 30 sekundach. Wybierz aktywny kraj albo zagraj na całym globie.', findPlayableCountry: 'Znajdź grywalny kraj', or: 'lub', playWholeGlobe: 'Graj na całym globie', points: 'Punkty', nextTrophy: 'Następne trofeum', allTrophiesUnlocked: 'Wszystkie trofea odblokowane', leaderboard: 'Ranking', loadingRanking: 'Ładowanie rankingu...', activity: 'Aktywność', playAnytime: 'graj kiedy chcesz', secondsToResult: '{value}s do wyniku', lastGames: 'Ostatnie 3 gry' },
  },
  nl: {
    nav: { byCountry: 'Per land', howItWorks: 'Hoe het werkt', leaderboard: 'Ranglijst', play: 'Spelen', playGame: 'Spelen', gridGame: 'Grid Game', comingSoon: 'Binnenkort', menu: 'Menu openen', language: 'Taal' },
    live: { console: 'Live console', globeActivity: 'Globe-activiteit', orbitTo: 'Ga naar', wholeGlobe: 'Hele globe', backToGlobe: 'Terug naar globe', nearMe: 'In mijn buurt', findingNearby: 'Bliksem in de buurt zoeken…', nearbyStrikes: '{count} bliksems in de buurt', layers: 'Lagen', layersPro: 'Lagen · Pro', free: 'Vrij', beginner: 'Beginner', pro: 'Pro', game: 'Spel', day: 'Dag', night: 'Nacht', good: 'goed', medium: 'middel', bad: 'slecht', close: 'Sluiten', preparingProfile: 'Profiel voorbereiden…' },
    countryPanel: { live: 'Live', idle: 'Rustig', noStrikeData: 'Geen bliksemdata', unavailable: 'Data is niet beschikbaar voor dit gebied: er is geen ISO-landcode.', loading: 'Recente bliksem laden…', learnMore: 'Meer over {country}', strikesLastHour: 'bliksems · laatste uur', recentRate: 'recent tempo', lastStrike: 'laatste bliksem', latest: 'Laatste {count} bliksems · venster {span}', now: 'Nu', secondsAgo: '{value}s geleden', minutesAgo: '{value}m geleden', hoursAgo: '{value}u geleden', intensity: { intense: 'Intens', active: 'Actief', moderate: 'Matig', light: 'Licht', calm: 'Rustig' } },
    seo: { dataSource: 'Live bliksemdata van het community-detectienetwerk Blitzortung.', play: 'Spelen' },
    layers: { recent1h: 'Bliksem · 1 u', recent1hDescription: 'Bliksem van het laatste uur.', recent3h: 'Bliksem · 3 u', recent3hDescription: 'Bliksem van 1 tot 3 uur geleden.', recent6h: 'Bliksem · 6 u', recent6hDescription: 'Bliksem van 3 tot 6 uur geleden.', clouds: 'Wolken', cloudsDescription: 'Live bewolking wereldwijd.', rain: 'Regen', rainDescription: 'Live regen, minuut per minuut.', temperature: 'Temperatuur', temperatureDescription: 'Warmte van de planeet, blauw tot rood.', wind: 'Wind', windDescription: 'Lucht in beweging, wereldwijd.' },
    gamePanel: { strikeGame: 'Bliksemspel', notPlayable: 'Niet speelbaar', notPlayableBody: 'Hier is in de laatste 30 seconden geen bliksem gedetecteerd. Kies een land met live activiteit of speel op de hele globe.', findPlayableCountry: 'Vind een speelbaar land', or: 'of', playWholeGlobe: 'Speel op de hele globe', points: 'Punten', nextTrophy: 'Volgende trofee', allTrophiesUnlocked: 'Alle trofeeën ontgrendeld', leaderboard: 'Ranglijst', loadingRanking: 'Ranglijst laden...', activity: 'Activiteit', playAnytime: 'speel wanneer je wilt', secondsToResult: '{value}s tot resultaat', lastGames: 'Laatste 3 spellen' },
  },
  fi: {
    nav: { byCountry: 'Maittain', howItWorks: 'Näin se toimii', leaderboard: 'Tulostaulu', play: 'Pelaa', playGame: 'Pelaa', gridGame: 'Ruudukkopeli', comingSoon: 'Tulossa pian', menu: 'Avaa valikko', language: 'Kieli' },
    live: { console: 'Live-konsoli', globeActivity: 'Maapallon aktiivisuus', orbitTo: 'Siirry kohteeseen', wholeGlobe: 'Koko maapallo', backToGlobe: 'Takaisin maapalloon', nearMe: 'Lähellä minua', findingNearby: 'Etsitään lähellä olevia salamoita…', nearbyStrikes: '{count} salamaa lähellä', layers: 'Tasot', layersPro: 'Tasot · Pro', free: 'Vapaa', beginner: 'Aloittelija', pro: 'Pro', game: 'Peli', day: 'Päivä', night: 'Yö', good: 'hyvä', medium: 'keskitaso', bad: 'huono', close: 'Sulje', preparingProfile: 'Valmistellaan peliprofiilia…' },
    countryPanel: { live: 'Live', idle: 'Rauhallinen', noStrikeData: 'Ei salamatietoja', unavailable: 'Tietoja ei ole saatavilla tälle alueelle: ISO-maakoodia ei ole.', loading: 'Ladataan viimeisimpiä salamoita…', learnMore: 'Lisätietoja: {country}', strikesLastHour: 'salamaa · viime tunti', recentRate: 'viimeaikainen tahti', lastStrike: 'viimeisin salama', latest: 'Viimeisimmät {count} salamaa · {span} ikkuna', now: 'Nyt', secondsAgo: '{value}s sitten', minutesAgo: '{value}m sitten', hoursAgo: '{value}h sitten', intensity: { intense: 'Voimakas', active: 'Aktiivinen', moderate: 'Kohtalainen', light: 'Kevyt', calm: 'Rauhallinen' } },
    seo: { dataSource: 'Reaaliaikaiset salamatiedot Blitzortung-yhteisöverkosta.', play: 'Pelaa' },
    layers: { recent1h: 'Salamat · 1 h', recent1hDescription: 'Viimeisen tunnin salamat.', recent3h: 'Salamat · 3 h', recent3hDescription: '1–3 tuntia vanhat salamat.', recent6h: 'Salamat · 6 h', recent6hDescription: '3–6 tuntia vanhat salamat.', clouds: 'Pilvet', cloudsDescription: 'Reaaliaikainen pilvipeite maailmassa.', rain: 'Sade', rainDescription: 'Reaaliaikainen sade minuutti minuutilta.', temperature: 'Lämpötila', temperatureDescription: 'Maapallon lämpö sinisestä punaiseen.', wind: 'Tuuli', windDescription: 'Ilman liike maailmanlaajuisesti.' },
    gamePanel: { strikeGame: 'Salamapeli', notPlayable: 'Ei pelattavissa', notPlayableBody: 'Täällä ei havaittu salamoita viimeisen 30 sekunnin aikana. Valitse aktiivinen maa tai pelaa koko maapallolla.', findPlayableCountry: 'Etsi pelattava maa', or: 'tai', playWholeGlobe: 'Pelaa koko maapallolla', points: 'Pisteet', nextTrophy: 'Seuraava pokaali', allTrophiesUnlocked: 'Kaikki pokaalit avattu', leaderboard: 'Tulostaulu', loadingRanking: 'Ladataan sijoituksia...', activity: 'Aktiivisuus', playAnytime: 'pelaa milloin vain', secondsToResult: '{value}s tulokseen', lastGames: 'Viimeiset 3 peliä' },
  },
  et: {
    nav: { byCountry: 'Riigi järgi', howItWorks: 'Kuidas see töötab', leaderboard: 'Edetabel', play: 'Mängi', playGame: 'Mängi', gridGame: 'Ruudumäng', comingSoon: 'Peagi tulemas', menu: 'Ava menüü', language: 'Keel' },
    live: { console: 'Reaalaja konsool', globeActivity: 'Maakera aktiivsus', orbitTo: 'Liigu kohta', wholeGlobe: 'Kogu maakera', backToGlobe: 'Tagasi maakera juurde', nearMe: 'Minu lähedal', findingNearby: 'Otsin lähedasi välke…', nearbyStrikes: '{count} välku lähedal', layers: 'Kihid', layersPro: 'Kihid · Pro', free: 'Vaba', beginner: 'Algaja', pro: 'Pro', game: 'Mäng', day: 'Päev', night: 'Öö', good: 'hea', medium: 'keskmine', bad: 'halb', close: 'Sulge', preparingProfile: 'Valmistan mänguprofiili…' },
    countryPanel: { live: 'Reaalajas', idle: 'Rahulik', noStrikeData: 'Välguandmed puuduvad', unavailable: 'Selle territooriumi andmed pole saadaval: ISO riigikood puudub.', loading: 'Laen hiljutisi välke…', learnMore: 'Lisateave: {country}', strikesLastHour: 'välku · viimane tund', recentRate: 'hiljutine tempo', lastStrike: 'viimane välk', latest: 'Viimased {count} välku · {span} aken', now: 'Praegu', secondsAgo: '{value}s tagasi', minutesAgo: '{value}m tagasi', hoursAgo: '{value}h tagasi', intensity: { intense: 'Intensiivne', active: 'Aktiivne', moderate: 'Mõõdukas', light: 'Kerge', calm: 'Rahulik' } },
    seo: { dataSource: 'Reaalajas välguandmed Blitzortungi kogukonnavõrgust.', play: 'Mängi' },
    layers: { recent1h: 'Välgud · 1 h', recent1hDescription: 'Viimase tunni välgud.', recent3h: 'Välgud · 3 h', recent3hDescription: '1–3 tunni vanused välgud.', recent6h: 'Välgud · 6 h', recent6hDescription: '3–6 tunni vanused välgud.', clouds: 'Pilved', cloudsDescription: 'Reaalajas pilvkate maailmas.', rain: 'Vihm', rainDescription: 'Reaalajas vihm minut-minutilt.', temperature: 'Temperatuur', temperatureDescription: 'Planeedi soojus sinisest punaseni.', wind: 'Tuul', windDescription: 'Õhu liikumine maailmas.' },
    gamePanel: { strikeGame: 'Välgumäng', notPlayable: 'Pole mängitav', notPlayableBody: 'Siin ei tuvastatud viimase 30 sekundi jooksul välke. Vali aktiivne riik või mängi kogu maakeral.', findPlayableCountry: 'Leia mängitav riik', or: 'või', playWholeGlobe: 'Mängi kogu maakeral', points: 'Punktid', nextTrophy: 'Järgmine karikas', allTrophiesUnlocked: 'Kõik karikad avatud', leaderboard: 'Edetabel', loadingRanking: 'Edetabeli laadimine...', activity: 'Aktiivsus', playAnytime: 'mängi igal ajal', secondsToResult: '{value}s tulemuseni', lastGames: 'Viimased 3 mängu' },
  },
  sv: {
    nav: { byCountry: 'Efter land', howItWorks: 'Så fungerar det', leaderboard: 'Topplista', play: 'Spela', playGame: 'Spela', gridGame: 'Rutspel', comingSoon: 'Kommer snart', menu: 'Öppna meny', language: 'Språk' },
    live: { console: 'Livekonsol', globeActivity: 'Globaktivitet', orbitTo: 'Gå till', wholeGlobe: 'Hela globen', backToGlobe: 'Tillbaka till globen', nearMe: 'Nära mig', findingNearby: 'Söker blixtar nära dig…', nearbyStrikes: '{count} blixtar nära dig', layers: 'Lager', layersPro: 'Lager · Pro', free: 'Fri', beginner: 'Nybörjare', pro: 'Pro', game: 'Spel', day: 'Dag', night: 'Natt', good: 'bra', medium: 'medel', bad: 'dålig', close: 'Stäng', preparingProfile: 'Förbereder spelprofil…' },
    countryPanel: { live: 'Live', idle: 'Lugnt', noStrikeData: 'Ingen blixtdata', unavailable: 'Data är inte tillgänglig för detta område: ingen ISO-landskod finns.', loading: 'Laddar senaste blixtar…', learnMore: 'Läs mer om {country}', strikesLastHour: 'blixtar · senaste timmen', recentRate: 'senaste takt', lastStrike: 'senaste blixt', latest: 'Senaste {count} blixtar · {span} fönster', now: 'Nu', secondsAgo: '{value}s sedan', minutesAgo: '{value}m sedan', hoursAgo: '{value}h sedan', intensity: { intense: 'Intensiv', active: 'Aktiv', moderate: 'Måttlig', light: 'Lätt', calm: 'Lugn' } },
    seo: { dataSource: 'Live blixtdata från Blitzortungs community-nätverk.', play: 'Spela' },
    layers: { recent1h: 'Blixtar · 1 h', recent1hDescription: 'Blixtar från den senaste timmen.', recent3h: 'Blixtar · 3 h', recent3hDescription: 'Blixtar 1 till 3 timmar gamla.', recent6h: 'Blixtar · 6 h', recent6hDescription: 'Blixtar 3 till 6 timmar gamla.', clouds: 'Moln', cloudsDescription: 'Live molntäcke över världen.', rain: 'Regn', rainDescription: 'Live regn, minut för minut.', temperature: 'Temperatur', temperatureDescription: 'Planetens värme, blått till rött.', wind: 'Vind', windDescription: 'Luft i rörelse världen över.' },
    gamePanel: { strikeGame: 'Blixtspel', notPlayable: 'Inte spelbart', notPlayableBody: 'Inga blixtar upptäcktes här de senaste 30 sekunderna. Välj ett land med liveaktivitet eller spela på hela globen.', findPlayableCountry: 'Hitta ett spelbart land', or: 'eller', playWholeGlobe: 'Spela på hela globen', points: 'Poäng', nextTrophy: 'Nästa trofé', allTrophiesUnlocked: 'Alla troféer upplåsta', leaderboard: 'Topplista', loadingRanking: 'Laddar topplista...', activity: 'Aktivitet', playAnytime: 'spela när som helst', secondsToResult: '{value}s till resultat', lastGames: 'Senaste 3 spelen' },
  },
  nb: {
    nav: { byCountry: 'Etter land', howItWorks: 'Slik fungerer det', leaderboard: 'Toppliste', play: 'Spill', playGame: 'Spill', gridGame: 'Rutespill', comingSoon: 'Kommer snart', menu: 'Åpne meny', language: 'Språk' },
    live: { console: 'Live-konsoll', globeActivity: 'Globusaktivitet', orbitTo: 'Gå til', wholeGlobe: 'Hele globusen', backToGlobe: 'Tilbake til globusen', nearMe: 'Nær meg', findingNearby: 'Søker etter lyn i nærheten…', nearbyStrikes: '{count} lyn i nærheten', layers: 'Lag', layersPro: 'Lag · Pro', free: 'Fri', beginner: 'Nybegynner', pro: 'Pro', game: 'Spill', day: 'Dag', night: 'Natt', good: 'bra', medium: 'middels', bad: 'dårlig', close: 'Lukk', preparingProfile: 'Klargjør spillprofil…' },
    countryPanel: { live: 'Live', idle: 'Rolig', noStrikeData: 'Ingen lyndata', unavailable: 'Data er ikke tilgjengelig for dette området: det har ingen ISO-landskode.', loading: 'Laster nylige lyn…', learnMore: 'Les mer om {country}', strikesLastHour: 'lyn · siste time', recentRate: 'nylig tempo', lastStrike: 'siste lyn', latest: 'Siste {count} lyn · {span} vindu', now: 'Nå', secondsAgo: '{value}s siden', minutesAgo: '{value}m siden', hoursAgo: '{value}t siden', intensity: { intense: 'Intens', active: 'Aktiv', moderate: 'Moderat', light: 'Lett', calm: 'Rolig' } },
    seo: { dataSource: 'Live lyndata fra Blitzortung sitt fellesskapsnettverk.', play: 'Spill' },
    layers: { recent1h: 'Lyn · 1 t', recent1hDescription: 'Lyn fra den siste timen.', recent3h: 'Lyn · 3 t', recent3hDescription: 'Lyn som er 1 til 3 timer gamle.', recent6h: 'Lyn · 6 t', recent6hDescription: 'Lyn som er 3 til 6 timer gamle.', clouds: 'Skyer', cloudsDescription: 'Live skydekke over hele verden.', rain: 'Regn', rainDescription: 'Live regn, minutt for minutt.', temperature: 'Temperatur', temperatureDescription: 'Planetens varme, blå til rød.', wind: 'Vind', windDescription: 'Luft i bevegelse verden rundt.' },
    gamePanel: { strikeGame: 'Lynspill', notPlayable: 'Ikke spillbart', notPlayableBody: 'Ingen lyn ble oppdaget her de siste 30 sekundene. Velg et land med liveaktivitet, eller spill på hele globusen.', findPlayableCountry: 'Finn et spillbart land', or: 'eller', playWholeGlobe: 'Spill på hele globusen', points: 'Poeng', nextTrophy: 'Neste trofé', allTrophiesUnlocked: 'Alle trofeer låst opp', leaderboard: 'Toppliste', loadingRanking: 'Laster toppliste...', activity: 'Aktivitet', playAnytime: 'spill når som helst', secondsToResult: '{value}s til resultat', lastGames: 'Siste 3 spill' },
  },
  cs: {
    nav: { byCountry: 'Podle země', howItWorks: 'Jak to funguje', leaderboard: 'Žebříček', play: 'Hrát', playGame: 'Hrát', gridGame: 'Mřížková hra', comingSoon: 'Již brzy', menu: 'Otevřít menu', language: 'Jazyk' },
    live: { console: 'Živá konzole', globeActivity: 'Aktivita globu', orbitTo: 'Přejít na', wholeGlobe: 'Celý globus', backToGlobe: 'Zpět na globus', nearMe: 'V mém okolí', findingNearby: 'Hledám blízké blesky…', nearbyStrikes: '{count} blesků v okolí', layers: 'Vrstvy', layersPro: 'Vrstvy · Pro', free: 'Volně', beginner: 'Začátečník', pro: 'Pro', game: 'Hra', day: 'Den', night: 'Noc', good: 'dobré', medium: 'střední', bad: 'špatné', close: 'Zavřít', preparingProfile: 'Připravuji herní profil…' },
    countryPanel: { live: 'Živě', idle: 'Klid', noStrikeData: 'Žádná data o blescích', unavailable: 'Data nejsou pro toto území dostupná: nemá ISO kód země.', loading: 'Načítám poslední blesky…', learnMore: 'Více o {country}', strikesLastHour: 'blesků · poslední hodina', recentRate: 'aktuální tempo', lastStrike: 'poslední blesk', latest: 'Posledních {count} blesků · okno {span}', now: 'Nyní', secondsAgo: 'před {value}s', minutesAgo: 'před {value}m', hoursAgo: 'před {value}h', intensity: { intense: 'Intenzivní', active: 'Aktivní', moderate: 'Mírná', light: 'Slabá', calm: 'Klidná' } },
    seo: { dataSource: 'Živá data o blescích ze komunitní detekční sítě Blitzortung.', play: 'Hrát' },
    layers: { recent1h: 'Blesky · 1 h', recent1hDescription: 'Blesky z poslední hodiny.', recent3h: 'Blesky · 3 h', recent3hDescription: 'Blesky staré 1 až 3 hodiny.', recent6h: 'Blesky · 6 h', recent6hDescription: 'Blesky staré 3 až 6 hodin.', clouds: 'Mraky', cloudsDescription: 'Živá oblačnost po celém světě.', rain: 'Déšť', rainDescription: 'Živý déšť minutu po minutě.', temperature: 'Teplota', temperatureDescription: 'Teplo planety, od modré po červenou.', wind: 'Vítr', windDescription: 'Pohyb vzduchu po celém světě.' },
    gamePanel: { strikeGame: 'Hra s blesky', notPlayable: 'Nelze hrát', notPlayableBody: 'Za posledních 30 sekund zde nebyly detekovány žádné blesky. Vyber zemi s živou aktivitou nebo hraj na celém globu.', findPlayableCountry: 'Najít hratelnou zemi', or: 'nebo', playWholeGlobe: 'Hrát na celém globu', points: 'Body', nextTrophy: 'Další trofej', allTrophiesUnlocked: 'Všechny trofeje odemčeny', leaderboard: 'Žebříček', loadingRanking: 'Načítám žebříček...', activity: 'Aktivita', playAnytime: 'hrát kdykoliv', secondsToResult: '{value}s do výsledku', lastGames: 'Poslední 3 hry' },
  },
  lv: {
    nav: { byCountry: 'Pēc valsts', howItWorks: 'Kā tas darbojas', leaderboard: 'Līderu saraksts', play: 'Spēlēt', playGame: 'Spēlēt', gridGame: 'Režģa spēle', comingSoon: 'Drīzumā', menu: 'Atvērt izvēlni', language: 'Valoda' },
    live: { console: 'Tiešraides konsole', globeActivity: 'Globusa aktivitāte', orbitTo: 'Doties uz', wholeGlobe: 'Viss globuss', backToGlobe: 'Atpakaļ uz globusu', nearMe: 'Man tuvumā', findingNearby: 'Meklējam tuvus zibeņus…', nearbyStrikes: '{count} zibeņi tuvumā', layers: 'Slāņi', layersPro: 'Slāņi · Pro', free: 'Brīvi', beginner: 'Iesācējs', pro: 'Pro', game: 'Spēle', day: 'Diena', night: 'Nakts', good: 'labi', medium: 'vidēji', bad: 'slikti', close: 'Aizvērt', preparingProfile: 'Sagatavo spēles profilu…' },
    countryPanel: { live: 'Tiešraidē', idle: 'Mierīgi', noStrikeData: 'Nav zibens datu', unavailable: 'Dati šai teritorijai nav pieejami: tai nav ISO valsts koda.', loading: 'Ielādē jaunākos zibeņus…', learnMore: 'Uzzināt vairāk par {country}', strikesLastHour: 'zibeņi · pēdējā stunda', recentRate: 'jaunākais temps', lastStrike: 'pēdējais zibens', latest: 'Jaunākie {count} zibeņi · {span} logs', now: 'Tagad', secondsAgo: 'pirms {value}s', minutesAgo: 'pirms {value}m', hoursAgo: 'pirms {value}h', intensity: { intense: 'Intensīva', active: 'Aktīva', moderate: 'Mērena', light: 'Vāja', calm: 'Mierīga' } },
    seo: { dataSource: 'Tiešraides zibens dati no Blitzortung kopienas detekcijas tīkla.', play: 'Spēlēt' },
    layers: { recent1h: 'Zibeņi · 1 h', recent1hDescription: 'Zibeņi pēdējās stundas laikā.', recent3h: 'Zibeņi · 3 h', recent3hDescription: 'Zibeņi pirms 1 līdz 3 stundām.', recent6h: 'Zibeņi · 6 h', recent6hDescription: 'Zibeņi pirms 3 līdz 6 stundām.', clouds: 'Mākoņi', cloudsDescription: 'Mākoņu sega tiešraidē visā pasaulē.', rain: 'Lietus', rainDescription: 'Lietus tiešraidē pa minūtēm.', temperature: 'Temperatūra', temperatureDescription: 'Planētas siltums no zila līdz sarkanam.', wind: 'Vējš', windDescription: 'Gaisa kustība visā pasaulē.' },
    gamePanel: { strikeGame: 'Zibens spēle', notPlayable: 'Nav spēlējams', notPlayableBody: 'Šeit pēdējo 30 sekunžu laikā nav konstatēti zibeņi. Izvēlies aktīvu valsti vai spēlē uz visa globusa.', findPlayableCountry: 'Atrast spēlējamu valsti', or: 'vai', playWholeGlobe: 'Spēlēt uz visa globusa', points: 'Punkti', nextTrophy: 'Nākamā trofeja', allTrophiesUnlocked: 'Visas trofejas atbloķētas', leaderboard: 'Līderu saraksts', loadingRanking: 'Ielādē reitingu...', activity: 'Aktivitāte', playAnytime: 'spēlē jebkurā laikā', secondsToResult: '{value}s līdz rezultātam', lastGames: 'Pēdējās 3 spēles' },
  },
  hr: {
    nav: { byCountry: 'Po zemlji', howItWorks: 'Kako radi', leaderboard: 'Poredak', play: 'Igraj', playGame: 'Igraj', gridGame: 'Grid igra', comingSoon: 'Uskoro', menu: 'Otvori izbornik', language: 'Jezik' },
    live: { console: 'Live konzola', globeActivity: 'Aktivnost globusa', orbitTo: 'Idi na', wholeGlobe: 'Cijeli globus', backToGlobe: 'Natrag na globus', nearMe: 'Blizu mene', findingNearby: 'Tražim munje u blizini…', nearbyStrikes: '{count} munja u blizini', layers: 'Slojevi', layersPro: 'Slojevi · Pro', free: 'Slobodno', beginner: 'Početnik', pro: 'Pro', game: 'Igra', day: 'Dan', night: 'Noć', good: 'dobro', medium: 'srednje', bad: 'loše', close: 'Zatvori', preparingProfile: 'Priprema profila…' },
    countryPanel: { live: 'Uživo', idle: 'Mirno', noStrikeData: 'Nema podataka o munjama', unavailable: 'Podaci nisu dostupni za ovo područje: nema ISO kod zemlje.', loading: 'Učitavanje nedavnih munja…', learnMore: 'Saznaj više o {country}', strikesLastHour: 'munja · zadnji sat', recentRate: 'nedavni tempo', lastStrike: 'zadnja munja', latest: 'Zadnjih {count} munja · prozor {span}', now: 'Sada', secondsAgo: 'prije {value}s', minutesAgo: 'prije {value}m', hoursAgo: 'prije {value}h', intensity: { intense: 'Intenzivno', active: 'Aktivno', moderate: 'Umjereno', light: 'Slabo', calm: 'Mirno' } },
    seo: { dataSource: 'Podaci o munjama uživo iz zajedničke mreže Blitzortung.', play: 'Igraj' },
    layers: { recent1h: 'Munje · 1 h', recent1hDescription: 'Munje iz zadnjeg sata.', recent3h: 'Munje · 3 h', recent3hDescription: 'Munje stare 1 do 3 sata.', recent6h: 'Munje · 6 h', recent6hDescription: 'Munje stare 3 do 6 sati.', clouds: 'Oblaci', cloudsDescription: 'Oblačnost uživo diljem svijeta.', rain: 'Kiša', rainDescription: 'Kiša uživo, iz minute u minutu.', temperature: 'Temperatura', temperatureDescription: 'Toplina planeta, od plave do crvene.', wind: 'Vjetar', windDescription: 'Kretanje zraka u svijetu.' },
    gamePanel: { strikeGame: 'Igra munja', notPlayable: 'Nije igrivo', notPlayableBody: 'Ovdje u zadnjih 30 sekundi nisu otkrivene munje. Odaberi zemlju s aktivnošću uživo ili igraj na cijelom globusu.', findPlayableCountry: 'Pronađi igrivu zemlju', or: 'ili', playWholeGlobe: 'Igraj na cijelom globusu', points: 'Bodovi', nextTrophy: 'Sljedeći trofej', allTrophiesUnlocked: 'Svi trofeji otključani', leaderboard: 'Poredak', loadingRanking: 'Učitavanje poretka...', activity: 'Aktivnost', playAnytime: 'igraj bilo kada', secondsToResult: '{value}s do rezultata', lastGames: 'Zadnje 3 igre' },
  },
  el: {
    nav: { byCountry: 'Ανά χώρα', howItWorks: 'Πώς λειτουργεί', leaderboard: 'Κατάταξη', play: 'Παίξε', playGame: 'Παίξε', gridGame: 'Παιχνίδι πλέγματος', comingSoon: 'Σύντομα', menu: 'Άνοιγμα μενού', language: 'Γλώσσα' },
    live: { console: 'Ζωντανή κονσόλα', globeActivity: 'Δραστηριότητα υδρογείου', orbitTo: 'Μετάβαση σε', wholeGlobe: 'Ολόκληρη υδρόγειος', backToGlobe: 'Πίσω στην υδρόγειο', nearMe: 'Κοντά μου', findingNearby: 'Αναζήτηση κοντινών κεραυνών…', nearbyStrikes: '{count} κοντινοί κεραυνοί', layers: 'Επίπεδα', layersPro: 'Επίπεδα · Pro', free: 'Ελεύθερο', beginner: 'Αρχάριος', pro: 'Pro', game: 'Παιχνίδι', day: 'Ημέρα', night: 'Νύχτα', good: 'καλό', medium: 'μέτριο', bad: 'κακό', close: 'Κλείσιμο', preparingProfile: 'Προετοιμασία προφίλ…' },
    countryPanel: { live: 'Ζωντανά', idle: 'Ήρεμα', noStrikeData: 'Δεν υπάρχουν δεδομένα κεραυνών', unavailable: 'Τα δεδομένα δεν είναι διαθέσιμα για αυτή την περιοχή: δεν έχει ISO κωδικό χώρας.', loading: 'Φόρτωση πρόσφατων κεραυνών…', learnMore: 'Μάθε περισσότερα για {country}', strikesLastHour: 'κεραυνοί · τελευταία ώρα', recentRate: 'πρόσφατος ρυθμός', lastStrike: 'τελευταίος κεραυνός', latest: 'Τελευταίοι {count} κεραυνοί · παράθυρο {span}', now: 'Τώρα', secondsAgo: 'πριν {value}s', minutesAgo: 'πριν {value}λ', hoursAgo: 'πριν {value}ώ', intensity: { intense: 'Έντονη', active: 'Ενεργή', moderate: 'Μέτρια', light: 'Χαμηλή', calm: 'Ήρεμη' } },
    seo: { dataSource: 'Ζωντανά δεδομένα κεραυνών από το κοινοτικό δίκτυο Blitzortung.', play: 'Παίξε' },
    layers: { recent1h: 'Κεραυνοί · 1 ώ', recent1hDescription: 'Κεραυνοί της τελευταίας ώρας.', recent3h: 'Κεραυνοί · 3 ώ', recent3hDescription: 'Κεραυνοί ηλικίας 1 έως 3 ωρών.', recent6h: 'Κεραυνοί · 6 ώ', recent6hDescription: 'Κεραυνοί ηλικίας 3 έως 6 ωρών.', clouds: 'Σύννεφα', cloudsDescription: 'Ζωντανή νεφοκάλυψη παγκοσμίως.', rain: 'Βροχή', rainDescription: 'Ζωντανή βροχή, λεπτό προς λεπτό.', temperature: 'Θερμοκρασία', temperatureDescription: 'Θερμότητα του πλανήτη, από μπλε σε κόκκινο.', wind: 'Άνεμος', windDescription: 'Ο αέρας σε κίνηση παγκοσμίως.' },
    gamePanel: { strikeGame: 'Παιχνίδι κεραυνών', notPlayable: 'Δεν παίζεται', notPlayableBody: 'Δεν εντοπίστηκαν κεραυνοί εδώ τα τελευταία 30 δευτερόλεπτα. Διάλεξε χώρα με ζωντανή δραστηριότητα ή παίξε σε όλη την υδρόγειο.', findPlayableCountry: 'Βρες χώρα που παίζεται', or: 'ή', playWholeGlobe: 'Παίξε σε όλη την υδρόγειο', points: 'Πόντοι', nextTrophy: 'Επόμενο τρόπαιο', allTrophiesUnlocked: 'Όλα τα τρόπαια ξεκλειδώθηκαν', leaderboard: 'Κατάταξη', loadingRanking: 'Φόρτωση κατάταξης...', activity: 'Δραστηριότητα', playAnytime: 'παίξε οποιαδήποτε στιγμή', secondsToResult: '{value}s μέχρι το αποτέλεσμα', lastGames: 'Τελευταία 3 παιχνίδια' },
  },
  da: {
    nav: { byCountry: 'Efter land', howItWorks: 'Sådan virker det', leaderboard: 'Rangliste', play: 'Spil', playGame: 'Spil', gridGame: 'Gitterspil', comingSoon: 'Kommer snart', menu: 'Åbn menu', language: 'Sprog' },
    live: { console: 'Live-konsol', globeActivity: 'Globusaktivitet', orbitTo: 'Gå til', wholeGlobe: 'Hele globussen', backToGlobe: 'Tilbage til globussen', nearMe: 'I nærheden', findingNearby: 'Finder lyn i nærheden…', nearbyStrikes: '{count} lyn i nærheden', layers: 'Lag', layersPro: 'Lag · Pro', free: 'Fri', beginner: 'Begynder', pro: 'Pro', game: 'Spil', day: 'Dag', night: 'Nat', good: 'god', medium: 'middel', bad: 'dårlig', close: 'Luk', preparingProfile: 'Forbereder spilprofil…' },
    countryPanel: { live: 'Live', idle: 'Rolig', noStrikeData: 'Ingen lyndata', unavailable: 'Data er ikke tilgængelig for dette område: det har ingen ISO-landekode.', loading: 'Indlæser nylige lyn…', learnMore: 'Læs mere om {country}', strikesLastHour: 'lyn · sidste time', recentRate: 'nylig rate', lastStrike: 'sidste lyn', latest: 'Seneste {count} lyn · {span} vindue', now: 'Nu', secondsAgo: '{value}s siden', minutesAgo: '{value}m siden', hoursAgo: '{value}t siden', intensity: { intense: 'Intens', active: 'Aktiv', moderate: 'Moderat', light: 'Let', calm: 'Rolig' } },
    seo: { dataSource: 'Live lyndata fra Blitzortungs fællesskabsnetværk.', play: 'Spil' },
    layers: { recent1h: 'Lyn · 1 t', recent1hDescription: 'Lyn fra den sidste time.', recent3h: 'Lyn · 3 t', recent3hDescription: 'Lyn 1 til 3 timer gamle.', recent6h: 'Lyn · 6 t', recent6hDescription: 'Lyn 3 til 6 timer gamle.', clouds: 'Skyer', cloudsDescription: 'Live skydække over hele verden.', rain: 'Regn', rainDescription: 'Live regn, minut for minut.', temperature: 'Temperatur', temperatureDescription: 'Planetens varme, blå til rød.', wind: 'Vind', windDescription: 'Luft i bevægelse over hele verden.' },
    gamePanel: { strikeGame: 'Lynspil', notPlayable: 'Kan ikke spilles', notPlayableBody: 'Der blev ikke registreret lyn her de sidste 30 sekunder. Vælg et land med liveaktivitet, eller spil på hele globussen.', findPlayableCountry: 'Find et spilbart land', or: 'eller', playWholeGlobe: 'Spil på hele globussen', points: 'Point', nextTrophy: 'Næste trofæ', allTrophiesUnlocked: 'Alle trofæer låst op', leaderboard: 'Rangliste', loadingRanking: 'Indlæser rangliste...', activity: 'Aktivitet', playAnytime: 'spil når som helst', secondsToResult: '{value}s til resultat', lastGames: 'Seneste 3 spil' },
  },
  lt: {
    nav: { byCountry: 'Pagal šalį', howItWorks: 'Kaip tai veikia', leaderboard: 'Lyderių lentelė', play: 'Žaisti', playGame: 'Žaisti', gridGame: 'Tinklelio žaidimas', comingSoon: 'Netrukus', menu: 'Atidaryti meniu', language: 'Kalba' },
    live: { console: 'Tiesioginė konsolė', globeActivity: 'Gaublio aktyvumas', orbitTo: 'Eiti į', wholeGlobe: 'Visas gaublys', backToGlobe: 'Atgal į gaublį', nearMe: 'Netoli manęs', findingNearby: 'Ieškoma netoliese esančių žaibų…', nearbyStrikes: '{count} žaibai netoliese', layers: 'Sluoksniai', layersPro: 'Sluoksniai · Pro', free: 'Laisvai', beginner: 'Pradedantysis', pro: 'Pro', game: 'Žaidimas', day: 'Diena', night: 'Naktis', good: 'gerai', medium: 'vidutiniškai', bad: 'blogai', close: 'Uždaryti', preparingProfile: 'Ruošiamas profilis…' },
    countryPanel: { live: 'Tiesiogiai', idle: 'Ramu', noStrikeData: 'Nėra žaibų duomenų', unavailable: 'Duomenys šiai teritorijai nepasiekiami: nėra ISO šalies kodo.', loading: 'Įkeliami naujausi žaibai…', learnMore: 'Sužinoti daugiau apie {country}', strikesLastHour: 'žaibai · paskutinė valanda', recentRate: 'naujausias tempas', lastStrike: 'paskutinis žaibas', latest: 'Naujausi {count} žaibai · {span} langas', now: 'Dabar', secondsAgo: 'prieš {value}s', minutesAgo: 'prieš {value}m', hoursAgo: 'prieš {value}h', intensity: { intense: 'Intensyvi', active: 'Aktyvi', moderate: 'Vidutinė', light: 'Silpna', calm: 'Rami' } },
    seo: { dataSource: 'Tiesioginiai žaibų duomenys iš Blitzortung bendruomenės aptikimo tinklo.', play: 'Žaisti' },
    layers: { recent1h: 'Žaibai · 1 h', recent1hDescription: 'Žaibai per paskutinę valandą.', recent3h: 'Žaibai · 3 h', recent3hDescription: 'Žaibai prieš 1–3 valandas.', recent6h: 'Žaibai · 6 h', recent6hDescription: 'Žaibai prieš 3–6 valandas.', clouds: 'Debesys', cloudsDescription: 'Tiesioginė debesuotumo danga pasaulyje.', rain: 'Lietus', rainDescription: 'Tiesioginis lietus minutė po minutės.', temperature: 'Temperatūra', temperatureDescription: 'Planetos šiluma nuo mėlynos iki raudonos.', wind: 'Vėjas', windDescription: 'Oro judėjimas visame pasaulyje.' },
    gamePanel: { strikeGame: 'Žaibų žaidimas', notPlayable: 'Negalima žaisti', notPlayableBody: 'Čia per paskutines 30 sekundžių žaibų neaptikta. Pasirink aktyvią šalį arba žaisk visame gaublyje.', findPlayableCountry: 'Rasti žaidžiamą šalį', or: 'arba', playWholeGlobe: 'Žaisti visame gaublyje', points: 'Taškai', nextTrophy: 'Kitas trofėjus', allTrophiesUnlocked: 'Visi trofėjai atrakinti', leaderboard: 'Lyderių lentelė', loadingRanking: 'Įkeliama lyderių lentelė...', activity: 'Aktyvumas', playAnytime: 'žaisk bet kada', secondsToResult: '{value}s iki rezultato', lastGames: 'Paskutiniai 3 žaidimai' },
  },
  sk: {
    nav: { byCountry: 'Podľa krajiny', howItWorks: 'Ako to funguje', leaderboard: 'Rebríček', play: 'Hrať', playGame: 'Hrať', gridGame: 'Mriežková hra', comingSoon: 'Už čoskoro', menu: 'Otvoriť menu', language: 'Jazyk' },
    live: { console: 'Živá konzola', globeActivity: 'Aktivita glóbusu', orbitTo: 'Prejsť na', wholeGlobe: 'Celý glóbus', backToGlobe: 'Späť na glóbus', nearMe: 'V mojom okolí', findingNearby: 'Hľadám blízke blesky…', nearbyStrikes: '{count} bleskov v okolí', layers: 'Vrstvy', layersPro: 'Vrstvy · Pro', free: 'Voľne', beginner: 'Začiatočník', pro: 'Pro', game: 'Hra', day: 'Deň', night: 'Noc', good: 'dobré', medium: 'stredné', bad: 'zlé', close: 'Zavrieť', preparingProfile: 'Pripravuje sa herný profil…' },
    countryPanel: { live: 'Naživo', idle: 'Pokoj', noStrikeData: 'Žiadne dáta o bleskoch', unavailable: 'Dáta pre toto územie nie sú dostupné: nemá ISO kód krajiny.', loading: 'Načítavam nedávne blesky…', learnMore: 'Viac o {country}', strikesLastHour: 'bleskov · posledná hodina', recentRate: 'aktuálne tempo', lastStrike: 'posledný blesk', latest: 'Posledných {count} bleskov · okno {span}', now: 'Teraz', secondsAgo: 'pred {value}s', minutesAgo: 'pred {value}m', hoursAgo: 'pred {value}h', intensity: { intense: 'Intenzívna', active: 'Aktívna', moderate: 'Mierna', light: 'Slabá', calm: 'Pokojná' } },
    seo: { dataSource: 'Živé dáta o bleskoch z komunitnej detekčnej siete Blitzortung.', play: 'Hrať' },
    layers: { recent1h: 'Blesky · 1 h', recent1hDescription: 'Blesky z poslednej hodiny.', recent3h: 'Blesky · 3 h', recent3hDescription: 'Blesky staré 1 až 3 hodiny.', recent6h: 'Blesky · 6 h', recent6hDescription: 'Blesky staré 3 až 6 hodín.', clouds: 'Oblaky', cloudsDescription: 'Živá oblačnosť po celom svete.', rain: 'Dážď', rainDescription: 'Živý dážď, minútu po minúte.', temperature: 'Teplota', temperatureDescription: 'Teplo planéty, od modrej po červenú.', wind: 'Vietor', windDescription: 'Pohyb vzduchu po celom svete.' },
    gamePanel: { strikeGame: 'Hra s bleskami', notPlayable: 'Nedá sa hrať', notPlayableBody: 'Za posledných 30 sekúnd tu neboli zistené žiadne blesky. Vyber krajinu so živou aktivitou alebo hraj na celom glóbuse.', findPlayableCountry: 'Nájsť hrateľnú krajinu', or: 'alebo', playWholeGlobe: 'Hrať na celom glóbuse', points: 'Body', nextTrophy: 'Ďalšia trofej', allTrophiesUnlocked: 'Všetky trofeje odomknuté', leaderboard: 'Rebríček', loadingRanking: 'Načítavam rebríček...', activity: 'Aktivita', playAnytime: 'hraj kedykoľvek', secondsToResult: '{value}s do výsledku', lastGames: 'Posledné 3 hry' },
  },
  sr: {
    nav: { byCountry: 'Po zemlji', howItWorks: 'Kako radi', leaderboard: 'Rang lista', play: 'Igraj', playGame: 'Igraj', gridGame: 'Grid igra', comingSoon: 'Uskoro', menu: 'Otvori meni', language: 'Jezik' },
    live: { console: 'Live konzola', globeActivity: 'Aktivnost globusa', orbitTo: 'Idi na', wholeGlobe: 'Ceo globus', backToGlobe: 'Nazad na globus', nearMe: 'Blizu mene', findingNearby: 'Tražim munje u blizini…', nearbyStrikes: '{count} munja u blizini', layers: 'Slojevi', layersPro: 'Slojevi · Pro', free: 'Slobodno', beginner: 'Početnik', pro: 'Pro', game: 'Igra', day: 'Dan', night: 'Noć', good: 'dobro', medium: 'srednje', bad: 'loše', close: 'Zatvori', preparingProfile: 'Priprema profila…' },
    countryPanel: { live: 'Uživo', idle: 'Mirno', noStrikeData: 'Nema podataka o munjama', unavailable: 'Podaci nisu dostupni za ovu teritoriju: nema ISO kod zemlje.', loading: 'Učitavanje nedavnih munja…', learnMore: 'Saznaj više o {country}', strikesLastHour: 'munja · poslednji sat', recentRate: 'nedavni tempo', lastStrike: 'poslednja munja', latest: 'Poslednjih {count} munja · prozor {span}', now: 'Sada', secondsAgo: 'pre {value}s', minutesAgo: 'pre {value}m', hoursAgo: 'pre {value}h', intensity: { intense: 'Intenzivno', active: 'Aktivno', moderate: 'Umereno', light: 'Slabo', calm: 'Mirno' } },
    seo: { dataSource: 'Podaci o munjama uživo iz zajedničke mreže Blitzortung.', play: 'Igraj' },
    layers: { recent1h: 'Munje · 1 h', recent1hDescription: 'Munje iz poslednjeg sata.', recent3h: 'Munje · 3 h', recent3hDescription: 'Munje stare 1 do 3 sata.', recent6h: 'Munje · 6 h', recent6hDescription: 'Munje stare 3 do 6 sati.', clouds: 'Oblaci', cloudsDescription: 'Oblačnost uživo širom sveta.', rain: 'Kiša', rainDescription: 'Kiša uživo, iz minuta u minut.', temperature: 'Temperatura', temperatureDescription: 'Toplota planete, od plave do crvene.', wind: 'Vetar', windDescription: 'Kretanje vazduha širom sveta.' },
    gamePanel: { strikeGame: 'Igra munja', notPlayable: 'Nije igrivo', notPlayableBody: 'Ovde u poslednjih 30 sekundi nisu otkrivene munje. Izaberi zemlju sa aktivnošću uživo ili igraj na celom globusu.', findPlayableCountry: 'Pronađi igrivu zemlju', or: 'ili', playWholeGlobe: 'Igraj na celom globusu', points: 'Poeni', nextTrophy: 'Sledeći trofej', allTrophiesUnlocked: 'Svi trofeji otključani', leaderboard: 'Rang lista', loadingRanking: 'Učitavanje rang liste...', activity: 'Aktivnost', playAnytime: 'igraj bilo kada', secondsToResult: '{value}s do rezultata', lastGames: 'Poslednje 3 igre' },
  },
  ro: {
    nav: { byCountry: 'După țară', howItWorks: 'Cum funcționează', leaderboard: 'Clasament', play: 'Joacă', playGame: 'Joacă', gridGame: 'Joc grilă', comingSoon: 'În curând', menu: 'Deschide meniul', language: 'Limbă' },
    live: { console: 'Consolă live', globeActivity: 'Activitatea globului', orbitTo: 'Mergi la', wholeGlobe: 'Întregul glob', backToGlobe: 'Înapoi la glob', nearMe: 'Lângă mine', findingNearby: 'Caut fulgere în apropiere…', nearbyStrikes: '{count} fulgere în apropiere', layers: 'Straturi', layersPro: 'Straturi · Pro', free: 'Liber', beginner: 'Începător', pro: 'Pro', game: 'Joc', day: 'Zi', night: 'Noapte', good: 'bun', medium: 'mediu', bad: 'slab', close: 'Închide', preparingProfile: 'Se pregătește profilul…' },
    countryPanel: { live: 'Live', idle: 'Calm', noStrikeData: 'Nu există date despre fulgere', unavailable: 'Datele nu sunt disponibile pentru acest teritoriu: nu are cod ISO de țară.', loading: 'Se încarcă fulgerele recente…', learnMore: 'Află mai multe despre {country}', strikesLastHour: 'fulgere · ultima oră', recentRate: 'ritm recent', lastStrike: 'ultimul fulger', latest: 'Ultimele {count} fulgere · fereastră {span}', now: 'Acum', secondsAgo: 'acum {value}s', minutesAgo: 'acum {value}m', hoursAgo: 'acum {value}h', intensity: { intense: 'Intensă', active: 'Activă', moderate: 'Moderată', light: 'Slabă', calm: 'Calmă' } },
    seo: { dataSource: 'Date live despre fulgere din rețeaua comunitară Blitzortung.', play: 'Joacă' },
    layers: { recent1h: 'Fulgere · 1 h', recent1hDescription: 'Fulgere din ultima oră.', recent3h: 'Fulgere · 3 h', recent3hDescription: 'Fulgere vechi de 1 până la 3 ore.', recent6h: 'Fulgere · 6 h', recent6hDescription: 'Fulgere vechi de 3 până la 6 ore.', clouds: 'Nori', cloudsDescription: 'Acoperire noroasă live la nivel global.', rain: 'Ploaie', rainDescription: 'Ploaie live, minut cu minut.', temperature: 'Temperatură', temperatureDescription: 'Căldura planetei, de la albastru la roșu.', wind: 'Vânt', windDescription: 'Aer în mișcare în toată lumea.' },
    gamePanel: { strikeGame: 'Jocul fulgerelor', notPlayable: 'Nu poate fi jucat', notPlayableBody: 'Nu au fost detectate fulgere aici în ultimele 30 de secunde. Alege o țară cu activitate live sau joacă pe întregul glob.', findPlayableCountry: 'Găsește o țară jucabilă', or: 'sau', playWholeGlobe: 'Joacă pe întregul glob', points: 'Puncte', nextTrophy: 'Următorul trofeu', allTrophiesUnlocked: 'Toate trofeele deblocate', leaderboard: 'Clasament', loadingRanking: 'Se încarcă clasamentul...', activity: 'Activitate', playAnytime: 'joacă oricând', secondsToResult: '{value}s până la rezultat', lastGames: 'Ultimele 3 jocuri' },
  },
} as const satisfies Record<string, CopyTree>;

const UI_COPY_RECORD: Record<string, CopyTree> = UI_COPY;

const UI_EXTRA_COPY: Record<string, CopyTree> = {
  en: { liveSecondary: { recentStrikes: 'Recent strikes', waitingForStrikes: 'Waiting for strikes…', strikes: 'Strikes', last60s: 'last 60 s', last10Min: 'last 10 min', hottestRegion: 'Hottest region', telemetry: 'Telemetry', feed: 'Feed', avgLatency: 'Avg latency', activity15: 'Activity · last 15 min', peak: 'peak', now: 'now' } },
  es: { liveSecondary: { recentStrikes: 'Rayos recientes', waitingForStrikes: 'Esperando rayos…', strikes: 'Rayos', last60s: 'últimos 60 s', last10Min: 'últimos 10 min', hottestRegion: 'Región más activa', telemetry: 'Telemetría', feed: 'Señal', avgLatency: 'Latencia media', activity15: 'Actividad · últimos 15 min', peak: 'pico', now: 'ahora' } },
  fr: { liveSecondary: { recentStrikes: 'Impacts récents', waitingForStrikes: 'En attente d’impacts…', strikes: 'Impacts', last60s: '60 dernières s', last10Min: '10 dernières min', hottestRegion: 'Région la plus active', telemetry: 'Télémétrie', feed: 'Flux', avgLatency: 'Latence moy.', activity15: 'Activité · 15 dernières min', peak: 'pic', now: 'maintenant' } },
  de: { liveSecondary: { recentStrikes: 'Aktuelle Blitze', waitingForStrikes: 'Warte auf Blitze…', strikes: 'Blitze', last60s: 'letzte 60 s', last10Min: 'letzte 10 Min.', hottestRegion: 'Aktivste Region', telemetry: 'Telemetrie', feed: 'Feed', avgLatency: 'Ø Latenz', activity15: 'Aktivität · letzte 15 Min.', peak: 'Spitze', now: 'jetzt' } },
  it: { liveSecondary: { recentStrikes: 'Fulmini recenti', waitingForStrikes: 'In attesa di fulmini…', strikes: 'Fulmini', last60s: 'ultimi 60 s', last10Min: 'ultimi 10 min', hottestRegion: 'Regione più attiva', telemetry: 'Telemetria', feed: 'Feed', avgLatency: 'Latenza media', activity15: 'Attività · ultimi 15 min', peak: 'picco', now: 'ora' } },
  pt: { liveSecondary: { recentStrikes: 'Raios recentes', waitingForStrikes: 'À espera de raios…', strikes: 'Raios', last60s: 'últimos 60 s', last10Min: 'últimos 10 min', hottestRegion: 'Região mais ativa', telemetry: 'Telemetria', feed: 'Feed', avgLatency: 'Latência média', activity15: 'Atividade · últimos 15 min', peak: 'pico', now: 'agora' } },
  pl: { liveSecondary: { recentStrikes: 'Ostatnie wyładowania', waitingForStrikes: 'Oczekiwanie na wyładowania…', strikes: 'Wyładowania', last60s: 'ostatnie 60 s', last10Min: 'ostatnie 10 min', hottestRegion: 'Najaktywniejszy region', telemetry: 'Telemetria', feed: 'Sygnał', avgLatency: 'Śr. opóźnienie', activity15: 'Aktywność · ostatnie 15 min', peak: 'szczyt', now: 'teraz' } },
  nl: { liveSecondary: { recentStrikes: 'Recente bliksem', waitingForStrikes: 'Wachten op bliksem…', strikes: 'Bliksem', last60s: 'laatste 60 s', last10Min: 'laatste 10 min', hottestRegion: 'Actiefste regio', telemetry: 'Telemetrie', feed: 'Feed', avgLatency: 'Gem. vertraging', activity15: 'Activiteit · laatste 15 min', peak: 'piek', now: 'nu' } },
  fi: { liveSecondary: { recentStrikes: 'Viimeisimmät salamat', waitingForStrikes: 'Odotetaan salamoita…', strikes: 'Salamat', last60s: 'viimeiset 60 s', last10Min: 'viimeiset 10 min', hottestRegion: 'Aktiivisin alue', telemetry: 'Telemetria', feed: 'Syöte', avgLatency: 'Keskiv. viive', activity15: 'Aktiivisuus · viimeiset 15 min', peak: 'huippu', now: 'nyt' } },
  et: { liveSecondary: { recentStrikes: 'Hiljutised välgud', waitingForStrikes: 'Ootan välke…', strikes: 'Välgud', last60s: 'viimased 60 s', last10Min: 'viimased 10 min', hottestRegion: 'Aktiivseim piirkond', telemetry: 'Telemeetria', feed: 'Voog', avgLatency: 'Keskm. viide', activity15: 'Aktiivsus · viimased 15 min', peak: 'tipp', now: 'praegu' } },
  sv: { liveSecondary: { recentStrikes: 'Senaste blixtar', waitingForStrikes: 'Väntar på blixtar…', strikes: 'Blixtar', last60s: 'senaste 60 s', last10Min: 'senaste 10 min', hottestRegion: 'Mest aktiva region', telemetry: 'Telemetri', feed: 'Flöde', avgLatency: 'Snittlatens', activity15: 'Aktivitet · senaste 15 min', peak: 'topp', now: 'nu' } },
  nb: { liveSecondary: { recentStrikes: 'Nylige lyn', waitingForStrikes: 'Venter på lyn…', strikes: 'Lyn', last60s: 'siste 60 s', last10Min: 'siste 10 min', hottestRegion: 'Mest aktive region', telemetry: 'Telemetri', feed: 'Feed', avgLatency: 'Snittforsinkelse', activity15: 'Aktivitet · siste 15 min', peak: 'topp', now: 'nå' } },
  cs: { liveSecondary: { recentStrikes: 'Nedávné blesky', waitingForStrikes: 'Čekání na blesky…', strikes: 'Blesky', last60s: 'posl. 60 s', last10Min: 'posl. 10 min', hottestRegion: 'Nejaktivnější oblast', telemetry: 'Telemetrie', feed: 'Zdroj', avgLatency: 'Prům. latence', activity15: 'Aktivita · posl. 15 min', peak: 'špička', now: 'nyní' } },
  lv: { liveSecondary: { recentStrikes: 'Jaunākie zibeņi', waitingForStrikes: 'Gaida zibeņus…', strikes: 'Zibeņi', last60s: 'pēdējās 60 s', last10Min: 'pēdējās 10 min', hottestRegion: 'Aktīvākais reģions', telemetry: 'Telemetrija', feed: 'Plūsma', avgLatency: 'Vid. aizture', activity15: 'Aktivitāte · pēdējās 15 min', peak: 'maks.', now: 'tagad' } },
  hr: { liveSecondary: { recentStrikes: 'Nedavne munje', waitingForStrikes: 'Čekaju se munje…', strikes: 'Munje', last60s: 'zadnjih 60 s', last10Min: 'zadnjih 10 min', hottestRegion: 'Najaktivnija regija', telemetry: 'Telemetrija', feed: 'Feed', avgLatency: 'Prosj. latencija', activity15: 'Aktivnost · zadnjih 15 min', peak: 'vrh', now: 'sada' } },
  el: { liveSecondary: { recentStrikes: 'Πρόσφατοι κεραυνοί', waitingForStrikes: 'Αναμονή για κεραυνούς…', strikes: 'Κεραυνοί', last60s: 'τελευταία 60 δ', last10Min: 'τελευταία 10 λ', hottestRegion: 'Πιο ενεργή περιοχή', telemetry: 'Τηλεμετρία', feed: 'Ροή', avgLatency: 'Μέση καθυστέρηση', activity15: 'Δραστηριότητα · τελευταία 15 λ', peak: 'κορυφή', now: 'τώρα' } },
  da: { liveSecondary: { recentStrikes: 'Nylige lyn', waitingForStrikes: 'Venter på lyn…', strikes: 'Lyn', last60s: 'sidste 60 s', last10Min: 'sidste 10 min', hottestRegion: 'Mest aktive region', telemetry: 'Telemetri', feed: 'Feed', avgLatency: 'Gns. latenstid', activity15: 'Aktivitet · sidste 15 min', peak: 'top', now: 'nu' } },
  lt: { liveSecondary: { recentStrikes: 'Naujausi žaibai', waitingForStrikes: 'Laukiama žaibų…', strikes: 'Žaibai', last60s: 'pask. 60 s', last10Min: 'pask. 10 min', hottestRegion: 'Aktyviausias regionas', telemetry: 'Telemetrija', feed: 'Srautas', avgLatency: 'Vid. delsa', activity15: 'Aktyvumas · pask. 15 min', peak: 'pikas', now: 'dabar' } },
  sk: { liveSecondary: { recentStrikes: 'Nedávne blesky', waitingForStrikes: 'Čakanie na blesky…', strikes: 'Blesky', last60s: 'posl. 60 s', last10Min: 'posl. 10 min', hottestRegion: 'Najaktívnejší región', telemetry: 'Telemetria', feed: 'Zdroj', avgLatency: 'Priem. latencia', activity15: 'Aktivita · posl. 15 min', peak: 'špička', now: 'teraz' } },
  sr: { liveSecondary: { recentStrikes: 'Nedavne munje', waitingForStrikes: 'Čekaju se munje…', strikes: 'Munje', last60s: 'poslednjih 60 s', last10Min: 'poslednjih 10 min', hottestRegion: 'Najaktivniji region', telemetry: 'Telemetrija', feed: 'Feed', avgLatency: 'Prosečna latencija', activity15: 'Aktivnost · poslednjih 15 min', peak: 'vrh', now: 'sada' } },
  ro: { liveSecondary: { recentStrikes: 'Fulgere recente', waitingForStrikes: 'Se așteaptă fulgere…', strikes: 'Fulgere', last60s: 'ultimele 60 s', last10Min: 'ultimele 10 min', hottestRegion: 'Cea mai activă regiune', telemetry: 'Telemetrie', feed: 'Flux', avgLatency: 'Latență medie', activity15: 'Activitate · ultimele 15 min', peak: 'vârf', now: 'acum' } },
};

const EXTRA_LANGUAGE_ALIASES: Record<string, UiLanguage> = {
  br: 'pt',
  no: 'nb',
  nn: 'nb',
  cz: 'cs',
  dk: 'da',
  se: 'sv',
  ee: 'et',
  gr: 'el',
  rs: 'sr',
};

function normalizeLanguage(value: string | null | undefined): UiLanguage | null {
  if (!value) return null;
  const code = value.toLowerCase().split('-')[0];
  const alias = EXTRA_LANGUAGE_ALIASES[code];
  if (alias) return alias;
  return LANGUAGE_SET.has(code as UiLanguage) ? (code as UiLanguage) : null;
}

function detectBrowserLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  if (stored) return stored;
  for (const language of window.navigator.languages ?? [window.navigator.language]) {
    const normalized = normalizeLanguage(language);
    if (normalized) return normalized;
  }
  return 'en';
}

function lookup(copy: CopyTree, path: string): string | null {
  let current: string | CopyTree = copy;
  for (const part of path.split('.')) {
    if (!current || typeof current === 'string') return null;
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
}

export function formatCopy(template: string, params: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function translateUi(language: UiLanguage, path: string, params?: Record<string, string | number>) {
  const template =
    lookup(UI_EXTRA_COPY[language] ?? UI_EXTRA_COPY.en, path) ??
    lookup(UI_COPY_RECORD[language] ?? UI_COPY.en, path) ??
    lookup(UI_EXTRA_COPY.en, path) ??
    lookup(UI_COPY.en, path) ??
    path;
  return formatCopy(template, params);
}

function getLanguageSnapshot(): UiLanguage {
  return detectBrowserLanguage();
}

function subscribeLanguage(listener: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };

  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

function setStoredLanguage(next: UiLanguage) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useUiLanguage() {
  const language = useSyncExternalStore<UiLanguage>(subscribeLanguage, getLanguageSnapshot, () => 'en');

  return { language, setLanguage: setStoredLanguage };
}

export function useT() {
  const { language, setLanguage } = useUiLanguage();
  return useMemo(
    () => ({
      language,
      setLanguage,
      t: (path: string, params?: Record<string, string | number>) => translateUi(language, path, params),
    }),
    [language],
  );
}
