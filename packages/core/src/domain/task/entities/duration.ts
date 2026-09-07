/**
 * Durée estimée d'une tâche, en minutes. `null` signifie « indéterminée ».
 * Le set est volontairement fermé : trois choix suffisent à la saisie rapide,
 * et un champ libre ralentirait l'ajout mobile.
 */
export const TASK_DURATIONS = [15, 30, 60] as const;

export type TaskDuration = (typeof TASK_DURATIONS)[number];

export function isTaskDuration(value: unknown): value is TaskDuration {
  return typeof value === 'number' && (TASK_DURATIONS as readonly number[]).includes(value);
}

/** Ramène une durée libre (en minutes) sur le palier le plus proche. */
export function snapToDuration(minutes: number): TaskDuration | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  let best: TaskDuration = TASK_DURATIONS[0];
  for (const candidate of TASK_DURATIONS) {
    if (Math.abs(candidate - minutes) < Math.abs(best - minutes)) best = candidate;
  }
  return best;
}

export function formatDuration(duration: TaskDuration | null): string {
  if (duration === null) return 'Indéterminée';
  return duration === 60 ? '1 h' : `${duration} min`;
}
