import { registerSW } from 'virtual:pwa-register';

/**
 * Enregistre le service worker et applique la mise à jour dès qu'elle est
 * prête : l'app est mono-utilisateur et servie depuis le homelab, une invite
 * « nouvelle version disponible » n'apporterait rien.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;

  const update = registerSW({
    immediate: true,
    onNeedRefresh: () => void update(true),
  });
}
