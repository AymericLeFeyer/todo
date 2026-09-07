import type { DateOnly } from './due-date.js';
import type { TaskDuration } from './duration.js';
import type { Tag } from '../../tag/entities/tag.js';

export const TASK_SOURCES = ['app', 'api'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  /** `null` = pas d'échéance : la tâche vit dans l'Inbox. */
  dueDate: DateOnly | null;
  duration: TaskDuration | null;
  /** Rang fractionnaire au sein d'un même jour (cf. services/position). */
  position: number;
  completedAt: string | null;
  source: TaskSource;
  /** Identifiant côté appelant (AyLabs) : garantit l'idempotence des imports. */
  externalId: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export function isCompleted(task: Task): boolean {
  return task.completedAt !== null;
}

export function isOverdue(task: Task, todayDate: DateOnly): boolean {
  return !isCompleted(task) && task.dueDate !== null && task.dueDate < todayDate;
}

/** Une tâche est « à faire aujourd'hui » si elle est due aujourd'hui ou en retard. */
export function isDueToday(task: Task, todayDate: DateOnly): boolean {
  return !isCompleted(task) && task.dueDate !== null && task.dueDate <= todayDate;
}

export function hasTag(task: Task, slug: string): boolean {
  return task.tags.some((tag) => tag.slug === slug);
}

/** Somme des durées estimées ; les tâches indéterminées sont ignorées. */
export function estimatedMinutes(tasks: readonly Task[]): number {
  return tasks.reduce((total, task) => total + (task.duration ?? 0), 0);
}
