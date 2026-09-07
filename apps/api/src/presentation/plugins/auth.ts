import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Container } from '../../container.js';

export const SESSION_COOKIE = 'todo_session';

/** Routes accessibles sans authentification. */
const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/status']);

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Comparaison à temps constant, pour ne pas exposer le mot de passe par timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Renseigné par le hook d'authentification pour chaque requête `/api`. */
    auth: { kind: 'session' | 'api-key' | 'open'; name?: string };
  }
}

/**
 * Deux voies d'accès coexistent :
 * - la PWA ouvre une session par mot de passe unique (cookie signé) ;
 * - les intégrations comme AyLabs présentent une clé dans `X-API-Key`.
 *
 * Sans `APP_PASSWORD`, l'API tourne en mode « réseau de confiance » : c'est le
 * cas d'usage homelab derrière VPN, mais l'avertissement au démarrage est là
 * pour rappeler que rien ne protège l'instance si elle est exposée.
 */
export function registerAuth(app: FastifyInstance, container: Container): void {
  const { config, repositories } = container;
  const authRequired = !config.authDisabled && config.appPassword !== null;

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api') || PUBLIC_PATHS.has(path)) {
      request.auth = { kind: 'open' };
      return;
    }

    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      const record = repositories.apiKeys.useByHash(hashApiKey(apiKey));
      if (!record) {
        return reply.code(401).send({ error: 'invalid_api_key', message: 'Clé API invalide' });
      }
      request.auth = { kind: 'api-key', name: record.name };
      return;
    }

    if (hasValidSession(request)) {
      request.auth = { kind: 'session' };
      return;
    }

    if (!authRequired) {
      request.auth = { kind: 'open' };
      return;
    }

    return reply.code(401).send({ error: 'unauthorized', message: 'Authentification requise' });
  });
}

export function hasValidSession(request: FastifyRequest): boolean {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return false;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid && unsigned.value === 'ok';
}
