/**
 * La pastille de l'icône n'existe, sur iOS, que pour une PWA installée sur
 * l'écran d'accueil et dont les notifications ont été autorisées. Elle est
 * silencieusement ignorée partout ailleurs.
 */
export function isBadgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/** L'app tourne-t-elle depuis l'écran d'accueil plutôt que dans un onglet ? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * Pose la pastille depuis la page. C'est le chemin utilisé à chaque ouverture,
 * à chaque mutation et au retour au premier plan ; le service worker prend le
 * relais app fermée, à la réception d'un push.
 */
export async function setAppBadge(count: number): Promise<void> {
  if (!isBadgeSupported()) return;

  try {
    if (count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch {
    // Pastille refusée (permission absente, navigateur sans support) : rien à
    // signaler, l'app affiche de toute façon le compteur dans sa barre.
  }
}
