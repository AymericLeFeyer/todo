import webpush from 'web-push';
import type { PushDeliveryResult, PushPayload, PushSender } from '../../domain/notifications.js';
import type { PushSubscriptionRecord } from '../../domain/repositories.js';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export class WebPushSender implements PushSender {
  readonly enabled: boolean;
  readonly publicKey: string | null;

  constructor(vapid: VapidKeys | null) {
    this.enabled = vapid !== null;
    this.publicKey = vapid?.publicKey ?? null;
    if (vapid) {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    }
  }

  async send(
    subscription: PushSubscriptionRecord,
    payload: PushPayload,
  ): Promise<PushDeliveryResult> {
    if (!this.enabled) return 'failed';

    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify(payload),
        // Apple exige une expiration courte et refuse les envois sans urgence
        // explicite sur certains endpoints.
        { TTL: 6 * 3600, urgency: 'normal' },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'expired';
      return 'failed';
    }
  }
}

/** Génère une paire de clés VAPID (utilisé par le script `npm run vapid`). */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

/** Implémentation inerte utilisée quand aucune clé VAPID n'est configurée. */
export class NoopPushSender implements PushSender {
  readonly enabled = false;
  readonly publicKey = null;

  async send(): Promise<PushDeliveryResult> {
    return 'failed';
  }
}
