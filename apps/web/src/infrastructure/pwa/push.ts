import { systemApi } from '../system/system-api.js';

export type PushStatus =
  'unsupported' | 'needs-install' | 'server-disabled' | 'denied' | 'default' | 'granted';

/**
 * La clé VAPID voyage en base64url ; `pushManager.subscribe` attend des
 * octets adossés à un `ArrayBuffer` (et non à un tampon partagé).
 */
function decodeVapidKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Demande l'autorisation puis enregistre l'abonnement côté serveur.
 *
 * Sur iOS, `Notification.requestPermission()` n'aboutit que depuis une PWA
 * installée sur l'écran d'accueil et en réponse à un geste de l'utilisateur :
 * l'appel doit rester déclenché par un clic.
 */
export async function subscribeToPush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';

  const { enabled, publicKey } = await systemApi.vapidPublicKey();
  if (!enabled || !publicKey) return 'server-disabled';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Apple impose des notifications visibles : pas de push silencieux.
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    }));

  await systemApi.subscribePush(subscription.toJSON());
  return 'granted';
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getSubscription();
  if (!subscription) return;

  await systemApi.unsubscribePush(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
