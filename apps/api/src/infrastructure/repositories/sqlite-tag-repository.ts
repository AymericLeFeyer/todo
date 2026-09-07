import { defaultTagColor, slugifyTag, uuidv7, type Tag } from '@todo/core';
import { ValidationError } from '@todo/core';
import type { Db } from '../db/connection.js';
import type { TagRepository } from '../../domain/repositories.js';

interface TagRow {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export class SqliteTagRepository implements TagRepository {
  constructor(private readonly db: Db) {}

  findAll(): Tag[] {
    return this.db
      .prepare('SELECT id, name, slug, color FROM tags ORDER BY name ASC')
      .all() as Tag[];
  }

  findBySlug(slug: string): Tag | null {
    const row = this.db
      .prepare('SELECT id, name, slug, color FROM tags WHERE slug = ?')
      .get(slug) as TagRow | undefined;
    return row ?? null;
  }

  /**
   * Accepte indifféremment des noms lisibles (« Montage Vidéo ») ou des slugs
   * (« montage-video ») : les intégrations comme AyLabs envoient ce qu'elles
   * ont sous la main, et un tag inconnu est créé plutôt que rejeté.
   */
  resolveOrCreate(names: readonly string[]): Tag[] {
    const resolved: Tag[] = [];
    const seen = new Set<string>();

    this.db.transaction(() => {
      for (const name of names) {
        const slug = slugifyTag(name);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        resolved.push(this.findBySlug(slug) ?? this.insert(name.trim(), slug));
      }
    })();

    return resolved;
  }

  create(name: string, color?: string): Tag {
    const slug = slugifyTag(name);
    if (!slug) throw new ValidationError(`Nom de tag invalide : ${name}`);

    const existing = this.findBySlug(slug);
    if (existing) throw new ValidationError(`Le tag « ${existing.name} » existe déjà`);

    return this.insert(name.trim(), slug, color);
  }

  update(id: string, patch: { name?: string; color?: string }): Tag | null {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (patch.name !== undefined) {
      const slug = slugifyTag(patch.name);
      if (!slug) throw new ValidationError(`Nom de tag invalide : ${patch.name}`);
      const conflict = this.findBySlug(slug);
      if (conflict && conflict.id !== id) {
        throw new ValidationError(`Le tag « ${conflict.name} » existe déjà`);
      }
      sets.push('name = ?', 'slug = ?');
      params.push(patch.name.trim(), slug);
    }
    if (patch.color !== undefined) {
      sets.push('color = ?');
      params.push(patch.color);
    }
    if (sets.length === 0) return this.findById(id);

    const result = this.db
      .prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params, id);
    return result.changes > 0 ? this.findById(id) : null;
  }

  delete(id: string): boolean {
    // ON DELETE CASCADE retire l'association ; les tâches, elles, sont conservées.
    return this.db.prepare('DELETE FROM tags WHERE id = ?').run(id).changes > 0;
  }

  countsBySlug(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT g.slug AS slug, COUNT(*) AS total
         FROM tags g
         JOIN task_tags tt ON tt.tag_id = g.id
         JOIN tasks t ON t.id = tt.task_id AND t.completed_at IS NULL
         GROUP BY g.slug`,
      )
      .all() as Array<{ slug: string; total: number }>;

    return Object.fromEntries(rows.map((row) => [row.slug, row.total]));
  }

  private findById(id: string): Tag | null {
    const row = this.db.prepare('SELECT id, name, slug, color FROM tags WHERE id = ?').get(id) as
      TagRow | undefined;
    return row ?? null;
  }

  private insert(name: string, slug: string, color?: string): Tag {
    const tag: Tag = { id: uuidv7(), name, slug, color: color ?? defaultTagColor(slug) };
    this.db
      .prepare('INSERT INTO tags (id, name, slug, color, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(tag.id, tag.name, tag.slug, tag.color, new Date().toISOString());
    return tag;
  }
}
