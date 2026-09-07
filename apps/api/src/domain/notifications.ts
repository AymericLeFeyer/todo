import type { PushSubscriptionRecord } from './repositories.js';

/**
 * Charge utile lue par le service worker. `badge` alimente `setAppBadge()`.
 *
 * iOS n'accepte pas de push silencieux : le service worker doit afficher une
 * notification pour chaque message reçu, faute de quoi Safari finit par
 * révoquer l'abonnement. `title` et `body` sont donc toujours renseignés.
 */
export interface PushPayload {
  title: string;
  body: string;
  badge: number;
  /** Chemin ouvert au clic sur la notification. */
  url: string;
  /** Regroupe les notifications d'une même famille pour éviter l'empilement. */
  tag: string;
}

export type PushDeliveryResult = 'sent' | 'expired' | 'failed';

/** Port de sortie : l'implémentation Web Push vit dans `infrastructure/push`. */
export interface PushSender {
  send(subscription: PushSubscriptionRecord, payload: PushPayload): Promise<PushDeliveryResult>;
  readonly enabled: boolean;
  readonly publicKey: string | null;
}
