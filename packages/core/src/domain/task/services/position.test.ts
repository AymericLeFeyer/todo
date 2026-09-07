import { describe, expect, it } from 'vitest';
import type { Task } from '../entities/task.js';
import {
  MIN_POSITION_GAP,
  POSITION_STEP,
  byPosition,
  needsRebalance,
  nextPosition,
  positionBetween,
  positionForIndex,
  rebalance,
} from './position.js';

function task(id: string, position: number): Task {
  return {
    id,
    title: id,
    notes: null,
    dueDate: '2026-09-07',
    duration: null,
    position,
    completedAt: null,
    source: 'app',
    externalId: null,
    tags: [],
    createdAt: '2026-09-07T08:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z',
  };
}

const day = [task('a', 1024), task('b', 2048), task('c', 3072)];

describe('positions fractionnaires', () => {
  it('insère entre deux voisins, avant le premier ou après le dernier', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(3072, null)).toBe(3072 + POSITION_STEP);
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
  });

  it('place une nouvelle tâche en fin de journée', () => {
    expect(nextPosition(day)).toBe(3072 + POSITION_STEP);
    expect(nextPosition([])).toBe(POSITION_STEP);
  });

  it('exclut la tâche déplacée du calcul pour un tri intra-journée', () => {
    // « a » passe en dernier : il doit se retrouver après « c », pas entre b et c.
    const position = positionForIndex(day, 2, 'a');
    expect(position).toBeGreaterThan(3072);

    // « c » remonte en tête.
    expect(positionForIndex(day, 0, 'c')).toBeLessThan(1024);
  });

  it('borne un index hors limites', () => {
    expect(positionForIndex(day, 99)).toBeGreaterThan(3072);
    expect(positionForIndex(day, -5)).toBeLessThan(1024);
  });

  it('détecte le besoin de réindexer puis répartit à nouveau', () => {
    expect(needsRebalance(day)).toBe(false);

    const serré = [task('a', 1), task('b', 1 + MIN_POSITION_GAP / 2)];
    expect(needsRebalance(serré)).toBe(true);

    expect(rebalance(serré)).toEqual([
      { id: 'a', position: POSITION_STEP },
      { id: 'b', position: POSITION_STEP * 2 },
    ]);
  });

  it('trie de façon stable même à positions égales', () => {
    const collision = [task('z', 10), task('a', 10)];
    expect([...collision].sort(byPosition).map((t) => t.id)).toEqual(['a', 'z']);
  });
});
