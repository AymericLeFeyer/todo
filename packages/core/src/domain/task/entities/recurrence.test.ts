import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './recurrence.js';

describe('nextOccurrence', () => {
  it("avance d'un jour, d'une semaine, d'un mois et d'un an", () => {
    expect(nextOccurrence('2026-09-08', 'daily')).toBe('2026-09-09');
    expect(nextOccurrence('2026-09-08', 'weekly')).toBe('2026-09-15');
    expect(nextOccurrence('2026-09-08', 'monthly')).toBe('2026-10-08');
    expect(nextOccurrence('2026-09-08', 'yearly')).toBe('2027-09-08');
  });

  it("rabat le jour sur la fin du mois d'arrivée", () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2026-08-31', 'monthly')).toBe('2026-09-30');
    expect(nextOccurrence('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  it('rattrape le retard pour ne jamais reprogrammer dans le passé', () => {
    // Tâche quotidienne du 1er septembre terminée le 8 : la suivante est demain.
    expect(nextOccurrence('2026-09-01', 'daily', '2026-09-08')).toBe('2026-09-09');
    // Une hebdomadaire saute autant de semaines qu'il faut, en gardant son jour.
    expect(nextOccurrence('2026-08-17', 'weekly', '2026-09-08')).toBe('2026-09-14');
  });

  it('laisse la date telle quelle quand elle est déjà dans le futur', () => {
    expect(nextOccurrence('2026-09-08', 'weekly', '2026-09-08')).toBe('2026-09-15');
  });
});
