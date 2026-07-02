import posthog from 'posthog-js';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken && process.env.NODE_ENV === 'production') {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
  });
}
