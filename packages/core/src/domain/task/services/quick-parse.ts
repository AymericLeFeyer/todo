import {
  addDays,
  nextWeekday,
  nextWeekend,
  toDateOnly,
  today,
  tomorrow,
  type DateOnly,
} from '../entities/due-date.js';
import { snapToDuration, type TaskDuration } from '../entities/duration.js';
import type { TaskRecurrence } from '../entities/recurrence.js';

export interface QuickParseMatch {
  type: 'date' | 'duration' | 'tag' | 'recurrence';
  text: string;
  start: number;
  end: number;
}

export interface QuickParseResult {
  /** Titre débarrassé des fragments reconnus. */
  title: string;
  dueDate: DateOnly | null;
  duration: TaskDuration | null;
  recurrence: TaskRecurrence | null;
  tagNames: string[];
  matches: QuickParseMatch[];
}

const WEEKDAYS: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
};

/**
 * Répétitions reconnues. La forme « tous les <jour> » capture le jour dans la
 * même expression : sans cela, le fragment « lundi » serait retiré du titre
 * deux fois par `stripMatches`, avec des indices qui se chevauchent.
 */
const RECURRENCE_RULES: Array<{ re: RegExp; recurrence: TaskRecurrence; weekday?: true }> = [
  { re: /\b(?:tous\s+les\s+jours|chaque\s+jour|quotidien(?:ne)?s?)\b/giu, recurrence: 'daily' },
  {
    re: /\b(?:toutes\s+les\s+semaines|chaque\s+semaine|hebdo(?:madaire)?s?)\b/giu,
    recurrence: 'weekly',
  },
  { re: /\b(?:tous\s+les\s+mois|chaque\s+mois|mensuel(?:le)?s?)\b/giu, recurrence: 'monthly' },
  {
    re: /\b(?:tous\s+les\s+ans|chaque\s+ann[ée]e|toutes\s+les\s+ann[ée]es|annuel(?:le)?s?)\b/giu,
    recurrence: 'yearly',
  },
  {
    re: /\b(?:tous\s+les|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/giu,
    recurrence: 'weekly',
    weekday: true,
  },
];

const TAG_RE = /#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const MINUTES_RE = /\b(\d{1,3})\s*(?:min\b|mins\b|minutes?\b|m\b)/giu;
const HOURS_RE = /\b(\d{1,2})\s*h(?:\s*(\d{1,2}))?\b/giu;
const IN_DAYS_RE = /\bdans\s+(\d{1,3})\s+jours?\b/giu;
const NUMERIC_DATE_RE = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/gu;

/**
 * Analyse la saisie libre de l'écran d'ajout : `Monter la vidéo demain 30min
 * #aylabs` devient un titre propre, une échéance, une durée et des tags.
 *
 * C'est ce qui rend l'ajout mobile réellement rapide : une seule frappe au
 * clavier, sans passer par trois sélecteurs. Les chips de l'interface
 * reflètent en direct ce qui a été reconnu, et restent modifiables.
 */
export function quickParse(input: string, now: Date = new Date()): QuickParseResult {
  const matches: QuickParseMatch[] = [];
  const tagNames: string[] = [];
  let dueDate: DateOnly | null = null;
  let duration: TaskDuration | null = null;
  let recurrence: TaskRecurrence | null = null;

  const record = (type: QuickParseMatch['type'], text: string, start: number) => {
    matches.push({ type, text, start, end: start + text.length });
  };

  for (const match of input.matchAll(TAG_RE)) {
    const name = match[1];
    if (!name) continue;
    tagNames.push(name);
    record('tag', match[0], match.index);
  }

  // La répétition passe en premier : « tous les lundis » fixe aussi
  // l'échéance, et son fragment doit être réservé avant l'analyse des dates.
  for (const rule of RECURRENCE_RULES) {
    if (recurrence !== null) break;
    for (const match of input.matchAll(rule.re)) {
      recurrence = rule.recurrence;
      record('recurrence', match[0], match.index);
      if (rule.weekday) {
        const iso = WEEKDAYS[(match[1] as string).toLowerCase()];
        if (iso) dueDate = nextWeekday(iso, now);
      }
      break;
    }
  }

  const overlapsMatch = (start: number, end: number) =>
    matches.some((match) => start < match.end && end > match.start);

  const takeDuration = (re: RegExp, toMinutes: (m: RegExpMatchArray) => number) => {
    if (duration !== null) return;
    for (const match of input.matchAll(re)) {
      const minutes = toMinutes(match);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      duration = snapToDuration(minutes);
      record('duration', match[0], match.index);
      return;
    }
  };

  // Au-delà de 8 h, il s'agit presque toujours d'une heure de la journée
  // (« réunion 14h ») et non d'une durée estimée : on ne la capture pas.
  takeDuration(HOURS_RE, (m) => {
    const hours = Number(m[1]);
    return hours > 8 ? 0 : hours * 60 + Number(m[2] ?? 0);
  });
  takeDuration(MINUTES_RE, (m) => Number(m[1]));

  const takeDate = (re: RegExp, resolve: (m: RegExpMatchArray) => DateOnly | null) => {
    if (dueDate !== null) return;
    for (const match of input.matchAll(re)) {
      if (overlapsMatch(match.index, match.index + match[0].length)) continue;
      const resolved = resolve(match);
      if (!resolved) continue;
      dueDate = resolved;
      record('date', match[0], match.index);
      return;
    }
  };

  takeDate(/\baujourd'?hui\b|\bauj\b/giu, () => today(now));
  takeDate(/\bapr[eè]s[-\s]demain\b/giu, () => addDays(today(now), 2));
  takeDate(/\bdemain\b/giu, () => tomorrow(now));
  takeDate(/\bce\s+week[-\s]?end\b|\bweek[-\s]?end\b/giu, () => nextWeekend(now));
  takeDate(/\b(?:la\s+)?semaine\s+prochaine\b/giu, () => nextWeekday(1, now));
  takeDate(IN_DAYS_RE, (m) => addDays(today(now), Number(m[1])));
  takeDate(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/giu, (m) => {
    const iso = WEEKDAYS[(m[1] as string).toLowerCase()];
    return iso ? nextWeekday(iso, now) : null;
  });
  takeDate(NUMERIC_DATE_RE, (m) => resolveNumericDate(m, now));

  // Une répétition sans échéance ne s'accrocherait à rien : la première
  // occurrence part donc d'aujourd'hui.
  if (recurrence !== null && dueDate === null) dueDate = today(now);

  return {
    title: stripMatches(input, matches),
    dueDate,
    duration,
    recurrence,
    tagNames,
    matches: matches.sort((a, b) => a.start - b.start),
  };
}

function resolveNumericDate(match: RegExpMatchArray, now: Date): DateOnly | null {
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const rawYear = match[3] ? Number(match[3]) : null;
  let year: number;
  if (rawYear === null) {
    // Sans année explicite, on vise la prochaine occurrence de la date.
    year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) year += 1;
  } else {
    year = rawYear < 100 ? 2000 + rawYear : rawYear;
  }

  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toDateOnly(date);
}

function stripMatches(input: string, matches: readonly QuickParseMatch[]): string {
  if (matches.length === 0) return input.trim();
  const ordered = [...matches].sort((a, b) => b.start - a.start);
  let result = input;
  for (const match of ordered) {
    result = result.slice(0, match.start) + result.slice(match.end);
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}
