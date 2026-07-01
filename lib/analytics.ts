// lib/analytics.ts
// Thin wrapper around GA4's gtag so the rest of the codebase never calls
// window.gtag directly. All calls are no-ops when GA4 is not loaded (local dev,
// ad-blockers, or when the GA_ID env var is missing).

import posthog from 'posthog-js';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function g(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

// ── Game events ─────────────────────────────────────────────────────────────
export function trackBetPlaced(params: {
  side: 'up' | 'down';
  amount: number;
  scope: 'globe' | 'country';
  scopeId: string;
}) {
  g('event', 'bet_placed', params);
  posthog.capture('bet_placed', params);
}

export function trackBetResolved(params: {
  outcome: 'won' | 'lost' | 'push';
  amount: number;
  payout: number;
  scope: 'globe' | 'country';
}) {
  g('event', 'bet_resolved', params);
  posthog.capture('bet_resolved', params);
}

export function trackTokensClaimed() {
  g('event', 'tokens_claimed');
  posthog.capture('tokens_claimed');
}

// ── Globe / UX events ────────────────────────────────────────────────────────
export function trackModeChange(mode: string) {
  g('event', 'mode_change', { mode });
  posthog.capture('mode_change', { mode });
}

export function trackCountrySelected(iso2: string | null, name: string) {
  g('event', 'country_selected', { iso2, name });
  posthog.capture('country_selected', { iso2, name });
}

export function trackSeoContentOpened(slug: string) {
  g('event', 'seo_content_opened', { slug });
  posthog.capture('seo_content_opened', { slug });
}

export function trackLayerToggled(layerId: string, active: boolean) {
  g('event', 'layer_toggled', { layer_id: layerId, active });
  posthog.capture('layer_toggled', { layer_id: layerId, active });
}
