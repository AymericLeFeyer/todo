import { describe, expect, it } from 'vitest';
import { formatDuration, isTaskDuration, snapToDuration } from './duration.js';

describe('durées', () => {
  it("n'accepte que les paliers du domaine", () => {
    expect(isTaskDuration(30)).toBe(true);
    expect(isTaskDuration(45)).toBe(false);
    expect(isTaskDuration('30')).toBe(false);
  });

  it('ramène une durée libre sur le palier le plus proche', () => {
    expect(snapToDuration(5)).toBe(15);
    expect(snapToDuration(25)).toBe(30);
    expect(snapToDuration(90)).toBe(60);
    expect(snapToDuration(0)).toBeNull();
  });

  it("formate pour l'affichage", () => {
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(null)).toBe('Indéterminée');
  });
});
