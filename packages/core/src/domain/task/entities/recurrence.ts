import { addDays, diffInDays, fromDateOnly, toDateOnly, type DateOnly } from './due-date.js';

/**
 * Répétition d'une tâche. Le set est fermé comme celui des durées : quatre
 * rythmes couvrent l'usage réel d'une todo personnelle, et un champ libre
 * (« tous les 3 mardis ») coûterait un éditeur de règle entier.
 */
export const TASK_RECURRENCES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

export function isTaskRecurrence(value: unknown): value is TaskRecurrence {
  return typeof value === 'string' && (TASK_RECURRENCES as readonly string[]).includes(value);
}

export function recurrenceLabel(recurrence: TaskRecurrence): string {
  switch (recurrence) {
    case 'daily':
      return 'Chaque jour';
    case 'weekly':
      return 'Chaque semaine';
    case 'monthly':
      return 'Chaque mois';
    case 'yearly':
      return 'Chaque année';
  }
}

/** Libellé compact pour la ligne d'une tâche dans une liste. */
export function recurrenceShortLabel(recurrence: TaskRecurrence): string {
  switch (recurrence) {
    case 'daily':
      return 'Quotidien';
    case 'weekly':
      return 'Hebdo';
    case 'monthly':
      return 'Mensuel';
    case 'yearly':
      return 'Annuel';
  }
}

/**
 * Échéance de l'occurrence suivante.
 *
 * `notBefore` sert au rattrapage : terminer aujourd'hui une tâche quotidienne
 * oubliée depuis une semaine doit la reprogrammer demain, pas six jours en
 * arrière. Sans lui, la tâche renaîtrait immédiatement en retard.
 */
export function nextOccurrence(
  dueDate: DateOnly,
  recurrence: TaskRecurrence,
  notBefore?: DateOnly,
): DateOnly {
  const next = step(dueDate, recurrence);
  if (notBefore === undefined || next > notBefore) return next;

  // Rattrapage d'un long retard. Les rythmes à pas fixe se calculent d'un
  // coup : une quotidienne oubliée depuis des années ferait sinon des
  // milliers de tours de boucle.
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const stride = recurrence === 'daily' ? 1 : 7;
    const steps = Math.floor(diffInDays(dueDate, notBefore) / stride) + 1;
    return addDays(dueDate, steps * stride);
  }

  // Les mois n'ont pas de longueur fixe : on avance pas à pas, borné à un
  // siècle pour qu'une date corrompue ne fasse pas boucler l'API.
  let candidate = next;
  for (let guard = 0; candidate <= notBefore && guard < 1200; guard += 1) {
    candidate = step(candidate, recurrence);
  }
  return candidate;
}

function step(dueDate: DateOnly, recurrence: TaskRecurrence): DateOnly {
  switch (recurrence) {
    case 'daily':
      return addDays(dueDate, 1);
    case 'weekly':
      return addDays(dueDate, 7);
    case 'monthly':
      return addMonths(dueDate, 1);
    case 'yearly':
      return addMonths(dueDate, 12);
  }
}

/**
 * Décalage en mois qui rabat le jour sur la fin du mois d'arrivée : le 31
 * janvier répété chaque mois devient le 28 février, pas le 3 mars.
 */
function addMonths(dueDate: DateOnly, months: number): DateOnly {
  const date = fromDateOnly(dueDate);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateOnly(target);
}
