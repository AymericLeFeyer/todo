import cron, { type ScheduledTask } from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import type { Container } from '../../container.js';

/**
 * Programme le résumé quotidien qui rafraîchit la pastille de l'icône iOS.
 *
 * C'est la seule façon de faire bouger ce compteur sans que l'app soit
 * ouverte : iOS n'autorise ni push silencieux, ni Background Sync pour une
 * PWA. Le push porte donc à la fois la notification visible et la valeur du
 * badge, que le service worker applique via `setAppBadge()`.
 */
export function startDailyDigest(
  container: Container,
  logger: FastifyBaseLogger,
): ScheduledTask | null {
  const { config, notifier } = container;

  if (!notifier.enabled) return null;
  if (!cron.validate(config.dailyDigestCron)) {
    logger.error({ cron: config.dailyDigestCron }, 'Expression cron invalide, résumé désactivé');
    return null;
  }

  const task = cron.schedule(
    config.dailyDigestCron,
    () => {
      notifier
        .sendDailyDigest()
        .then((sent) => logger.info({ sent }, 'Résumé quotidien envoyé'))
        .catch((error) => logger.error({ err: error }, 'Résumé quotidien en échec'));
    },
    { timezone: config.timezone },
  );

  logger.info(
    { cron: config.dailyDigestCron, timezone: config.timezone },
    'Résumé quotidien programmé',
  );
  return task;
}
