import { resolve } from 'node:path';

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function flag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export interface Config {
  host: string;
  port: number;
  databasePath: string;
  /** Racine des fichiers statiques de la PWA ; vide en développement (Vite sert le front). */
  webDistPath: string | null;
  /** Désactive toute authentification : réservé au développement local. */
  authDisabled: boolean;
  appPassword: string | null;
  sessionSecret: string;
  corsOrigins: string[];
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** Expression cron du résumé quotidien qui rafraîchit la pastille iOS. */
  dailyDigestCron: string;
  timezone: string;
  logLevel: string;
}

export function loadConfig(): Config {
  const vapidPublicKey = env('VAPID_PUBLIC_KEY', '');
  const vapidPrivateKey = env('VAPID_PRIVATE_KEY', '');
  const webDistPath = env('WEB_DIST_PATH', '');

  return {
    host: env('HOST', '0.0.0.0'),
    port: Number(env('PORT', '3000')),
    databasePath: resolve(env('DATABASE_PATH', './data/todo.db')),
    webDistPath: webDistPath ? resolve(webDistPath) : null,
    authDisabled: flag('AUTH_DISABLED'),
    appPassword: env('APP_PASSWORD', '') || null,
    sessionSecret: env('SESSION_SECRET', 'dev-secret-a-remplacer-en-production'),
    corsOrigins: env('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    vapid:
      vapidPublicKey && vapidPrivateKey
        ? {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: env('VAPID_SUBJECT', 'mailto:todo@localhost'),
          }
        : null,
    dailyDigestCron: env('DAILY_DIGEST_CRON', '0 7 * * *'),
    timezone: env('TZ', 'Europe/Paris'),
    logLevel: env('LOG_LEVEL', 'info'),
  };
}
