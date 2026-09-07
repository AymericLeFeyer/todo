/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title: string;
  body: string;
  badge: number;
  url: string;
  tag: string;
}

precacheAndRoute(self.__WB_MANIFEST);

/**
 * Les lectures de l'API passent d'abord par le réseau, avec repli sur le
 * cache : le serveur vit sur le homelab, donc hors VPN l'app doit au moins
 * afficher la dernière version connue plutôt qu'une page blanche.
 */
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 4 }),
);

self.addEventListener('install', () => {
  void self.skipWaiting();
});

clientsClaim();

/**
 * iOS n'autorise pas les push silencieux : chaque message reçu doit produire
 * une notification visible, faute de quoi Safari finit par révoquer
 * l'abonnement. On profite donc du même message pour poser la pastille de
 * l'icône, seule occasion de la mettre à jour app fermée.
 */
self.addEventListener('push', (event) => {
  const payload = readPayload(event.data);

  event.waitUntil(
    (async () => {
      await applyBadge(payload.badge);
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: payload.url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/today';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Réutiliser la fenêtre déjà ouverte évite d'empiler des instances de la
      // PWA à chaque notification.
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          await client.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/** Permet à la page de rafraîchir la pastille sans attendre un push. */
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; badge?: number } | undefined;
  if (data?.type === 'SET_BADGE') void applyBadge(data.badge ?? 0);
});

async function applyBadge(count: number): Promise<void> {
  if (!('setAppBadge' in self.navigator)) return;

  try {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // Pastille non supportée (navigateur de bureau, PWA non installée) :
    // ce n'est pas une raison pour perdre la notification.
  }
}

function readPayload(data: PushMessageData | null): PushPayload {
  const fallback: PushPayload = {
    title: 'Todo',
    body: 'Vous avez des tâches en attente',
    badge: 0,
    url: '/today',
    tag: 'todo',
  };

  if (!data) return fallback;
  try {
    return { ...fallback, ...(data.json() as Partial<PushPayload>) };
  } catch {
    return fallback;
  }
}
