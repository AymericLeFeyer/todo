import { ValidationError } from '../../shared/errors.js';

/**
 * Une échéance est une date civile locale au format `YYYY-MM-DD`, sans heure
 * ni fuseau : « demain » doit rester « demain » quel que soit l'endroit d'où
 * l'on consulte l'app. Toutes les conversions passent par ici.
 */
export type DateOnly = string;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false;
  const parsed = fromDateOnly(value);
  return toDateOnly(parsed) === value;
}

export function assertDateOnly(value: unknown): DateOnly {
  if (!isDateOnly(value)) throw new ValidationError(`Date invalide : ${String(value)}`);
  return value;
}

/** Convertit une `Date` (interprétée dans le fuseau local) en `YYYY-MM-DD`. */
export function toDateOnly(date: Date): DateOnly {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convertit `YYYY-MM-DD` en `Date` locale a minuit. */
export function fromDateOnly(value: DateOnly): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): DateOnly {
  return toDateOnly(now);
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const date = fromDateOnly(value);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

export function tomorrow(now: Date = new Date()): DateOnly {
  return addDays(today(now), 1);
}

/** Prochain samedi (aujourd'hui si l'on est déjà samedi). */
export function nextWeekend(now: Date = new Date()): DateOnly {
  const base = today(now);
  const weekday = fromDateOnly(base).getDay(); // 0 = dimanche, 6 = samedi
  const delta = weekday === 6 ? 0 : (6 - weekday + 7) % 7;
  return addDays(base, delta);
}

/** Prochaine occurrence d'un jour de semaine (1 = lundi ... 7 = dimanche). */
export function nextWeekday(isoWeekday: number, now: Date = new Date()): DateOnly {
  const base = today(now);
  const current = fromDateOnly(base).getDay() || 7;
  const delta = (isoWeekday - current + 7) % 7 || 7;
  return addDays(base, delta);
}

export function diffInDays(from: DateOnly, to: DateOnly): number {
  const ms = fromDateOnly(to).getTime() - fromDateOnly(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function isPast(value: DateOnly, now: Date = new Date()): boolean {
  return value < today(now);
}

export function isToday(value: DateOnly, now: Date = new Date()): boolean {
  return value === today(now);
}

export function isWeekend(value: DateOnly): boolean {
  const day = fromDateOnly(value).getDay();
  return day === 0 || day === 6;
}

/** Génère la liste des dates de `from` a `to` inclus. */
export function dateRange(from: DateOnly, to: DateOnly): DateOnly[] {
  const dates: DateOnly[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}
