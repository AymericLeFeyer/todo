import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from './container.js';
import { registerAuth } from './presentation/plugins/auth.js';
import { registerErrorHandler } from './presentation/plugins/error-handler.js';
import { registerTaskRoutes } from './presentation/routes/tasks.js';
import { registerTagRoutes } from './presentation/routes/tags.js';
import { registerPushRoutes } from './presentation/routes/push.js';
import { registerSystemRoutes } from './presentation/routes/system.js';

export async function buildApp(container: Container): Promise<FastifyInstance> {
  const { config } = container;

  const app = Fastify({
    logger: { level: config.logLevel },
    // Derrière Caddy ou Tailscale Serve, l'IP et le protocole d'origine
    // arrivent dans les en-têtes X-Forwarded-*.
    trustProxy: true,
  });

  await app.register(cookie, { secret: config.sessionSecret });

  // La PWA est servie par cette même instance : elle n'a donc pas besoin de
  // CORS. Seules les intégrations externes en ont l'usage.
  if (config.corsOrigins.length > 0) {
    await app.register(cors, { origin: config.corsOrigins, credentials: true });
  }

  registerErrorHandler(app);
  registerAuth(app, container);

  registerSystemRoutes(app, container);
  registerTaskRoutes(app, container);
  registerTagRoutes(app, container);
  registerPushRoutes(app, container);

  await registerWebApp(app, config.webDistPath);

  return app;
}

/**
 * Sert les fichiers statiques de la PWA et renvoie `index.html` pour toute
 * route inconnue : le routage est côté client, mais un rechargement sur
 * `/upcoming` doit fonctionner. Les chemins `/api` restent en 404 JSON.
 */
async function registerWebApp(app: FastifyInstance, webDistPath: string | null): Promise<void> {
  const hasWebApp = webDistPath !== null && existsSync(join(webDistPath, 'index.html'));

  if (hasWebApp) {
    await app.register(fastifyStatic, { root: webDistPath, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api') || !hasWebApp) {
      return reply
        .code(404)
        .send({ error: 'not_found', message: `Route inconnue : ${request.url}` });
    }
    return reply.sendFile('index.html');
  });
}
