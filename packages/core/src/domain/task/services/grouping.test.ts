import { describe, expect, it } from 'vitest';
import type { Task } from '../entities/task.js';
import { buildAgenda, relativeDayLabel, todayList } from './grouping.js';

const NOW = new Date(2026, 8, 7, 10, 0, 0);

function task(id: string, dueDate: string | null, position: number, completed = false): Task {
  return {
    id,
    title: id,
    notes: null,
    dueDate,
    duration: null,
    position,
    completedAt: completed ? '2026-09-07T09:00:00.000Z' : null,
    source: 'app',
    externalId: null,
    tags: [],
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };
}

const tasks = [
  task('retard-1', '2026-09-05', 2048),
  task('retard-2', '2026-09-01', 1024),
  task('auj-2', '2026-09-07', 2048),
  task('auj-1', '2026-09-07', 1024),
  task('demain', '2026-09-08', 1024),
  task('inbox', null, 1024),
  task('faite', '2026-09-07', 512, true),
];

describe('agenda', () => {
  it('regroupe les retards en tête et garde les jours vides', () => {
    const agenda = buildAgenda(tasks, '2026-09-07', '2026-09-10', NOW);

    expect(agenda.overdue.map((t) => t.id)).toEqual(['retard-2', 'retard-1']);
    expect(agenda.days.map((d) => d.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
    ]);
    // Les jours vides restent présents : ils servent de cible au glisser-déposer.
    expect(agenda.days[2]?.tasks).toEqual([]);
  });

  it('trie chaque journée par position et exclut terminées et Inbox', () => {
    const agenda = buildAgenda(tasks, '2026-09-07', '2026-09-08', NOW);
    expect(agenda.days[0]?.tasks.map((t) => t.id)).toEqual(['auj-1', 'auj-2']);
    expect(agenda.days.flatMap((d) => d.tasks).map((t) => t.id)).not.toContain('inbox');
    expect(agenda.days.flatMap((d) => d.tasks).map((t) => t.id)).not.toContain('faite');
  });

  it("place les retards avant les tâches du jour dans la vue Aujourd'hui", () => {
    expect(todayList(tasks, NOW).map((t) => t.id)).toEqual([
      'retard-2',
      'retard-1',
      'auj-1',
      'auj-2',
    ]);
  });

  it('nomme les deux premiers jours', () => {
    expect(relativeDayLabel('2026-09-07', NOW)).toBe("Aujourd'hui");
    expect(relativeDayLabel('2026-09-08', NOW)).toBe('Demain');
    expect(relativeDayLabel('2026-09-09', NOW)).toBeNull();
  });
});
