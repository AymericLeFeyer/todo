export interface Tag {
  id: string;
  name: string;
  /** Clé stable utilisée par l'API et les URLs : `#Montage Vidéo` -> `montage-video`. */
  slug: string;
  color: string;
}

/** Palette utilisée quand aucune couleur n'est fournie à la création. */
export const TAG_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;

export function slugifyTag(name: string): string {
  return name
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Couleur déterministe : un même tag garde la même couleur d'une base à l'autre. */
export function defaultTagColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length] as string;
}
