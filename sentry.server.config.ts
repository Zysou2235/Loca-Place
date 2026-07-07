import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Le DSN est absent tant que Sentry n'est pas configuré (dev, tests) :
  // le SDK reste alors silencieux, aucune erreur n'est envoyée.
  enabled: Boolean(process.env.SENTRY_DSN),
});
