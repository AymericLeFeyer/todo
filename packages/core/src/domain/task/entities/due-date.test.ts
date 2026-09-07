import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  diffInDays,
  fromDateOnly,
  isDateOnly,
  isPast,
  isWeekend,
  nextWeekday,
  nextWeekend,
  toDateOnly,
  today,
  tomorrow,
} from './due-date.js';

/** Lundi 7 septembre 2026, 10 h locales. */
const NOW = new Date(2026, 8, 7, 10, 0, 0);

describe('DateOnly', () => {
  it("valide le format et l'existence réelle de la date", () => {
    expect(isDateOnly('2026-09-07')).toBe(true);
    expect(isDateOnly('2026-2-07')).toBe(false);
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('hier')).toBe(false);
    expect(isDateOnly(20260907)).toBe(false);
  });

  it("fait l'aller-retour sans décalage de fuseau", () => {
    expect(toDateOnly(fromDateOnly('2026-01-01'))).toBe('2026-01-01');
    expect(toDateOnly(fromDateOnly('2026-12-31'))).toBe('2026-12-31');
    expect(toDateOnly(NOW)).toBe('2026-09-07');
  });

  it("calcule aujourd'hui et demain", () => {
    expect(today(NOW)).toBe('2026-09-07');
    expect(tomorrow(NOW)).toBe('2026-09-08');
  });

  it('franchit les fins de mois et les années bissextiles', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('trouve le prochain week-end et le prochain jour de semaine', () => {
    expect(nextWeekend(NOW)).toBe('2026-09-12');
    // Un samedi, « ce week-end » désigne le jour même.
    expect(nextWeekend(new Date(2026, 8, 12))).toBe('2026-09-12');
    expect(nextWeekday(1, NOW)).toBe('2026-09-14');
    expect(nextWeekday(5, NOW)).toBe('2026-09-11');
  });

  it('compare et énumère les dates', () => {
    expect(diffInDays('2026-09-07', '2026-09-10')).toBe(3);
    expect(isPast('2026-09-06', NOW)).toBe(true);
    expect(isPast('2026-09-07', NOW)).toBe(false);
    expect(isWeekend('2026-09-12')).toBe(true);
    expect(dateRange('2026-09-07', '2026-09-09')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });
});
