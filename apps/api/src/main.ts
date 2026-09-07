import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { startDailyDigest } from './infrastructure/scheduler/daily-digest.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const container = createContainer(config);
  const app = await buildApp(container);

  if (!config.authDisabled && config.appPassword === null) {
    app.log.warn(
      "APP_PASSWORD n'est pas défini : l'API est ouverte à tout le réseau qui peut l'atteindre. " +
        'Acceptable derrière un VPN, à proscrire dès que le service est exposé.',
    );
  }
  if (!container.sender.enabled) {
    app.log.warn(
      'Clés VAPID absentes : les notifications et la pastille iOS en arrière-plan sont désactivées. ' +
        'Générez-les avec `npm run vapid -w @todo/api`.',
    );
  }

  const digest = startDailyDigest(container, app.log);

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Arrêt en cours');
    digest?.stop();
    await app.close();
    container.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error) => {
  console.error('Démarrage impossible', error);
  process.exit(1);
});
