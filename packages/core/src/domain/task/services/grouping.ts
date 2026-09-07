import { addDays, dateRange, today, type DateOnly } from '../entities/due-date.js';
import { isCompleted, type Task } from '../entities/task.js';
import { byPosition } from './position.js';

export interface DaySection {
  date: DateOnly;
  tasks: Task[];
}

export interface AgendaSections {
  /** Tâches non terminées dont l'échéance est passée, regroupées en tête. */
  overdue: Task[];
  days: DaySection[];
}

/**
 * Construit les sections de l'agenda vertical : une section par jour de la
 * fenêtre demandée, y compris les jours vides (ils doivent rester visibles
 * pour servir de cible au glisser-déposer).
 */
export function buildAgenda(
  tasks: readonly Task[],
  from: DateOnly,
  to: DateOnly,
  now: Date = new Date(),
): AgendaSections {
  const todayDate = today(now);
  const byDate = new Map<DateOnly, Task[]>();
  const overdue: Task[] = [];

  for (const task of tasks) {
    if (isCompleted(task) || task.dueDate === null) continue;
    if (task.dueDate < todayDate) {
      overdue.push(task);
      continue;
    }
    const bucket = byDate.get(task.dueDate);
    if (bucket) bucket.push(task);
    else byDate.set(task.dueDate, [task]);
  }

  const days = dateRange(from, to).map((date) => ({
    date,
    tasks: (byDate.get(date) ?? []).sort(byPosition),
  }));

  return { overdue: overdue.sort(byPosition), days };
}

/** Tâches du jour : en retard + dues aujourd'hui, dans cet ordre. */
export function todayList(tasks: readonly Task[], now: Date = new Date()): Task[] {
  const todayDate = today(now);
  return tasks
    .filter((task) => !isCompleted(task) && task.dueDate !== null && task.dueDate <= todayDate)
    .sort((a, b) => {
      const aDate = a.dueDate as DateOnly;
      const bDate = b.dueDate as DateOnly;
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return byPosition(a, b);
    });
}

/** Libellé humain d'une date de section : « Aujourd'hui », « Demain », sinon null. */
export function relativeDayLabel(date: DateOnly, now: Date = new Date()): string | null {
  const todayDate = today(now);
  if (date === todayDate) return "Aujourd'hui";
  if (date === addDays(todayDate, 1)) return 'Demain';
  return null;
}
