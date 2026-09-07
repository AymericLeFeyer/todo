import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { SESSION_COOKIE, hasValidSession, hashApiKey, safeEqual } from '../plugins/auth.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // un an : l'app mobile reste connectée

export function registerSystemRoutes(app: FastifyInstance, container: Container): void {
  const { config, repositories, useCases } = container;
  const authRequired = !config.authDisabled && config.appPassword !== null;

  app.get('/api/health', async () => ({ status: 'ok', version: 1 }));

  app.get('/api/stats/today', async () => useCases.todayStats.execute());

  app.get('/api/auth/status', async (request) => ({
    authRequired,
    authenticated: !authRequired || hasValidSession(request),
    pushEnabled: container.sender.enabled,
  }));

  app.post('/api/auth/login', async (request, reply) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(request.body);

    if (!authRequired) return { ok: true };
    if (!safeEqual(password, config.appPassword as string)) {
      return reply.code(401).send({ error: 'invalid_password', message: 'Mot de passe incorrect' });
    }

    reply.setCookie(SESSION_COOKIE, 'ok', {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      secure: request.protocol === 'https',
    });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/api-keys', async () => ({ keys: repositories.apiKeys.findAll() }));

  /**
   * La clé en clair n'est renvoyée qu'à la création : seule son empreinte est
   * stockée, donc elle est irrécupérable ensuite.
   */
  app.post('/api/api-keys', async (request, reply) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(64) }).parse(request.body);
    const key = `todo_${randomBytes(24).toString('base64url')}`;
    const record = repositories.apiKeys.create(name, hashApiKey(key));
    return reply.code(201).send({ ...record, key });
  });

  app.delete('/api/api-keys/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    repositories.apiKeys.delete(id);
    return reply.code(204).send();
  });
}
