import { useEffect } from 'react';
import { setAppBadge } from '@/infrastructure/pwa/badge';
import { useTodayStats } from '../task/task-queries';

/**
 * Maintient la pastille de l'icône alignée sur les tâches du jour.
 *
 * C'est le chemin qui couvre l'essentiel des cas : ouverture de l'app, retour
 * au premier plan, et chaque mutation, puisque les statistiques sont
 * invalidées avec les listes. Le push quotidien du serveur ne sert qu'à
 * rafraîchir la pastille quand l'app est restée fermée.
 */
export function useBadgeSync(): void {
  const { data: stats } = useTodayStats();
  const badge = stats?.badge ?? 0;

  useEffect(() => {
    void setAppBadge(badge);
  }, [badge]);
}

/** Monté une fois dans l'arbre : n'affiche rien, se contente de synchroniser. */
export function BadgeSync(): null {
  useBadgeSync();
  return null;
}
