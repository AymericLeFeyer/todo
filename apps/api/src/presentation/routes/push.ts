import { uuidv7 } from '@todo/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export function registerPushRoutes(app: FastifyInstance, container: Container): void {
  const { repositories, sender, notifier, useCases } = container;

  app.get('/api/push/vapid-public-key', async () => ({
    enabled: sender.enabled,
    publicKey: sender.publicKey,
  }));

  app.post('/api/push/subscription', async (request, reply) => {
    const subscription = subscriptionSchema.parse(request.body);
    repositories.push.save({
      id: uuidv7(),
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete('/api/push/subscription', async (request, reply) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(request.body);
    repositories.push.deleteByEndpoint(endpoint);
    return reply.code(204).send();
  });

  /**
   * Déclenche le résumé quotidien à la demande. Sert à vérifier depuis
   * l'iPhone que la pastille se met bien à jour app fermée, sans attendre
   * l'heure du cron.
   */
  app.post('/api/push/test', async () => {
    const sent = await notifier.broadcast({
      title: 'Todo',
      body: 'Notification de test',
      badge: useCases.todayStats.execute().badge,
      url: '/today',
      tag: 'test',
    });
    return { sent, enabled: sender.enabled };
  });
}
