import { describe, expect, it } from 'vitest';
import { quickParse } from './quick-parse.js';

/** Lundi 7 septembre 2026. */
const NOW = new Date(2026, 8, 7, 10, 0, 0);

describe('quickParse', () => {
  it('laisse intacte une saisie sans marqueur', () => {
    const result = quickParse('Sortir les poubelles', NOW);
    expect(result).toMatchObject({
      title: 'Sortir les poubelles',
      dueDate: null,
      duration: null,
      tagNames: [],
    });
  });

  it('extrait date, durée et tags puis nettoie le titre', () => {
    const result = quickParse('Monter la vidéo demain 30min #aylabs #montage', NOW);
    expect(result.title).toBe('Monter la vidéo');
    expect(result.dueDate).toBe('2026-09-08');
    expect(result.duration).toBe(30);
    expect(result.tagNames).toEqual(['aylabs', 'montage']);
  });

  it('reconnaît les échéances relatives françaises', () => {
    expect(quickParse("Appeler le dentiste aujourd'hui", NOW).dueDate).toBe('2026-09-07');
    expect(quickParse('Ranger le bureau après-demain', NOW).dueDate).toBe('2026-09-09');
    expect(quickParse('Courses ce week-end', NOW).dueDate).toBe('2026-09-12');
    expect(quickParse('Facture vendredi', NOW).dueDate).toBe('2026-09-11');
    expect(quickParse('Relancer dans 3 jours', NOW).dueDate).toBe('2026-09-10');
    expect(quickParse('Point équipe la semaine prochaine', NOW).dueDate).toBe('2026-09-14');
  });

  it('accepte les dates numériques et vise la prochaine occurrence', () => {
    expect(quickParse('Anniversaire 25/12', NOW).dueDate).toBe('2026-12-25');
    // Une date déjà passée cette année bascule sur l'année suivante.
    expect(quickParse('Bilan 01/03', NOW).dueDate).toBe('2027-03-01');
    expect(quickParse('Deadline 12/03/2027', NOW).dueDate).toBe('2027-03-12');
    expect(quickParse('Rien le 45/13', NOW).dueDate).toBeNull();
  });

  it('ramène les durées libres sur les paliers 15 / 30 / 60', () => {
    expect(quickParse('Tri des mails 1h', NOW).duration).toBe(60);
    expect(quickParse('Pause 20 min', NOW).duration).toBe(15);
    expect(quickParse('Montage 1h30', NOW).duration).toBe(60);
  });

  it('ne prend pas une heure de rendez-vous pour une durée', () => {
    const result = quickParse('Réunion 14h', NOW);
    expect(result.duration).toBeNull();
    expect(result.title).toBe('Réunion 14h');
  });

  it('ne retient que la première date et la première durée', () => {
    const result = quickParse('Truc demain vendredi 15min 30min', NOW);
    expect(result.dueDate).toBe('2026-09-08');
    expect(result.duration).toBe(15);
    expect(result.title).toBe('Truc vendredi 30min');
  });

  it('expose les fragments reconnus pour la surbrillance', () => {
    const result = quickParse('Vidéo demain #aylabs', NOW);
    expect(result.matches.map((m) => m.type)).toEqual(['date', 'tag']);
    expect(result.matches.map((m) => m.text)).toEqual(['demain', '#aylabs']);
  });
  it('reconnaît les répétitions et les sort du titre', () => {
    expect(quickParse('Arroser les plantes chaque jour', NOW)).toMatchObject({
      title: 'Arroser les plantes',
      recurrence: 'daily',
      // Une répétition sans échéance démarre aujourd'hui.
      dueDate: '2026-09-07',
    });
    expect(quickParse('Facture tous les mois', NOW).recurrence).toBe('monthly');
    expect(quickParse('Anniversaire chaque année', NOW).recurrence).toBe('yearly');
    expect(quickParse('Sport toutes les semaines', NOW).recurrence).toBe('weekly');
  });

  it('cale « tous les <jour> » sur la prochaine occurrence du jour', () => {
    const result = quickParse('Poubelles tous les mardis', NOW);
    expect(result).toMatchObject({
      title: 'Poubelles',
      recurrence: 'weekly',
      dueDate: '2026-09-08',
    });
  });

  it('laisse une date explicite primer sur le démarrage par défaut', () => {
    const result = quickParse('Bilan chaque mois demain', NOW);
    expect(result.recurrence).toBe('monthly');
    expect(result.dueDate).toBe('2026-09-08');
    expect(result.title).toBe('Bilan');
  });
});
