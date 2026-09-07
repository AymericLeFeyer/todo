import { generateVapidKeys } from '../infrastructure/push/web-push-sender.js';

/**
 * Génère la paire de clés VAPID à coller dans le `.env`. Les clés sont
 * durables : les régénérer invalide tous les abonnements existants, il faudra
 * réautoriser les notifications sur chaque appareil.
 */
const keys = generateVapidKeys();

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
