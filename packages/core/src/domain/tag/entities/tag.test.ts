import { describe, expect, it } from 'vitest';
import { TAG_COLORS, defaultTagColor, slugifyTag } from './tag.js';

describe('tags', () => {
  it('normalise accents, espaces et casse', () => {
    expect(slugifyTag('Montage Vidéo')).toBe('montage-video');
    expect(slugifyTag('  AyLabs  ')).toBe('aylabs');
    expect(slugifyTag('Perso / Santé')).toBe('perso-sante');
    expect(slugifyTag('---')).toBe('');
  });

  it('attribue une couleur stable et issue de la palette', () => {
    const color = defaultTagColor('aylabs');
    expect(color).toBe(defaultTagColor('aylabs'));
    expect(TAG_COLORS).toContain(color);
  });
});
