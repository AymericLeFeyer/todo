import type { Task } from '../entities/task.js';

/** Écart appliqué entre deux tâches créées à la suite. */
export const POSITION_STEP = 1024;

/**
 * En deçà de ce seuil, deux positions consécutives ne peuvent plus être
 * séparées de façon fiable en virgule flottante : il faut réindexer le jour.
 */
export const MIN_POSITION_GAP = 1e-6;

/**
 * Calcule la position d'une tâche insérée entre `before` et `after`.
 * Les positions sont fractionnaires : déplacer une tâche ne réécrit qu'une
 * seule ligne, au lieu de renuméroter tout le jour.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null) return (after as number) - POSITION_STEP;
  if (after === null) return before + POSITION_STEP;
  return (before + after) / 2;
}

/**
 * Position à donner à une tâche déposée à l'index `targetIndex` d'une liste
 * déjà triée. `movedTaskId` est exclu du calcul pour qu'un déplacement au sein
 * du même jour ne se compare pas à lui-même.
 */
export function positionForIndex(
  orderedTasks: readonly Task[],
  targetIndex: number,
  movedTaskId?: string,
): number {
  const others = movedTaskId ? orderedTasks.filter((t) => t.id !== movedTaskId) : orderedTasks;
  const index = Math.max(0, Math.min(targetIndex, others.length));
  const before = index > 0 ? (others[index - 1]?.position ?? null) : null;
  const after = index < others.length ? (others[index]?.position ?? null) : null;
  return positionBetween(before, after);
}

/** Position à donner à une nouvelle tâche ajoutée en fin de journée. */
export function nextPosition(orderedTasks: readonly Task[]): number {
  const last = orderedTasks.at(-1);
  return last ? last.position + POSITION_STEP : POSITION_STEP;
}

/** Indique si les positions sont devenues trop serrées pour rester exploitables. */
export function needsRebalance(orderedTasks: readonly Task[]): boolean {
  for (let i = 1; i < orderedTasks.length; i += 1) {
    const previous = orderedTasks[i - 1] as Task;
    const current = orderedTasks[i] as Task;
    if (current.position - previous.position < MIN_POSITION_GAP) return true;
  }
  return false;
}

/** Réattribue des positions régulièrement espacées en conservant l'ordre. */
export function rebalance(orderedTasks: readonly Task[]): Array<{ id: string; position: number }> {
  return orderedTasks.map((task, index) => ({
    id: task.id,
    position: (index + 1) * POSITION_STEP,
  }));
}

/** Tri stable d'une journée : par position croissante, puis par identifiant. */
export function byPosition(a: Task, b: Task): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
