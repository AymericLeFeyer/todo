import {
  slugifyTag,
  type DateOnly,
  type Tag,
  type Task,
  type TaskDuration,
  type TaskSource,
} from '@todo/core';
import type { Db } from '../db/connection.js';
import type {
  NewTask,
  TaskCounts,
  TaskFilters,
  TaskMove,
  TaskPatch,
  TaskRepository,
} from '../../domain/repositories.js';

interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  duration: number | null;
  position: number;
  completed_at: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  task_id: string;
  id: string;
  name: string;
  slug: string;
  color: string;
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? (this.hydrate([row])[0] ?? null) : null;
  }

  findByExternalId(externalId: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE external_id = ?').get(externalId) as
      TaskRow | undefined;
    return row ? (this.hydrate([row])[0] ?? null) : null;
  }

  list(filters: TaskFilters): Task[] {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.status === 'open') where.push('t.completed_at IS NULL');
    if (filters.status === 'done') where.push('t.completed_at IS NOT NULL');

    if (filters.noDate) {
      where.push('t.due_date IS NULL');
    } else {
      if (filters.from) {
        where.push('t.due_date >= ?');
        params.push(filters.from);
      }
      if (filters.to) {
        where.push('t.due_date <= ?');
        params.push(filters.to);
      }
    }

    if (filters.search) {
      where.push('(t.title LIKE ? OR t.notes LIKE ?)');
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern);
    }

    const slugs = (filters.tags ?? []).map(slugifyTag).filter(Boolean);
    let tagJoin = '';
    let having = '';
    if (slugs.length > 0) {
      // Le filtre par tags passe par un semi-join : on ne duplique pas les
      // lignes de `tasks`, et le mode « all » se contente d'un HAVING.
      tagJoin = `
        JOIN task_tags tt ON tt.task_id = t.id
        JOIN tags g ON g.id = tt.tag_id AND g.slug IN (${slugs.map(() => '?').join(',')})
      `;
      params.unshift(...slugs);
      if (filters.tagsMode === 'all') {
        having = `HAVING COUNT(DISTINCT g.slug) = ${slugs.length}`;
      }
    }

    const sql = `
      SELECT t.* FROM tasks t
      ${tagJoin}
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ${slugs.length > 0 ? 'GROUP BY t.id' : ''}
      ${having}
      ORDER BY t.due_date IS NULL, t.due_date ASC, t.position ASC, t.id ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(sql).all(...params, filters.limit, filters.offset) as TaskRow[];
    return this.hydrate(rows);
  }

  listByDueDate(dueDate: DateOnly | null): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE completed_at IS NULL AND ${dueDate === null ? 'due_date IS NULL' : 'due_date = ?'}
         ORDER BY position ASC, id ASC`,
      )
      .all(...(dueDate === null ? [] : [dueDate])) as TaskRow[];
    return this.hydrate(rows);
  }

  create(task: NewTask): Task {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO tasks
             (id, title, notes, due_date, duration, position, completed_at,
              source, external_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        )
        .run(
          task.id,
          task.title,
          task.notes,
          task.dueDate,
          task.duration,
          task.position,
          task.source,
          task.externalId,
          now,
          now,
        );
      this.replaceTags(task.id, task.tagIds);
    })();

    return this.findById(task.id) as Task;
  }

  update(id: string, patch: TaskPatch): Task | null {
    const exists = this.db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!exists) return null;

    const sets: string[] = [];
    const params: unknown[] = [];
    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.title !== undefined) assign('title', patch.title);
    if (patch.notes !== undefined) assign('notes', patch.notes);
    if (patch.dueDate !== undefined) assign('due_date', patch.dueDate);
    if (patch.duration !== undefined) assign('duration', patch.duration);
    if (patch.position !== undefined) assign('position', patch.position);
    if (patch.completed !== undefined) {
      assign('completed_at', patch.completed ? new Date().toISOString() : null);
    }

    this.db.transaction(() => {
      if (sets.length > 0) {
        assign('updated_at', new Date().toISOString());
        this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
      }
      if (patch.tagIds !== undefined) this.replaceTags(id, patch.tagIds);
    })();

    return this.findById(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
  }

  move(moves: readonly TaskMove[]): Task[] {
    const now = new Date().toISOString();
    const statement = this.db.prepare(
      'UPDATE tasks SET due_date = ?, position = ?, updated_at = ? WHERE id = ?',
    );

    this.db.transaction(() => {
      for (const move of moves) statement.run(move.dueDate, move.position, now, move.id);
    })();

    const ids = moves.map((move) => move.id);
    const rows = this.db
      .prepare(`SELECT * FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as TaskRow[];
    return this.hydrate(rows);
  }

  countForBadge(todayDate: DateOnly): TaskCounts {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END), 0) AS overdue,
           COALESCE(SUM(CASE WHEN due_date = ? THEN 1 ELSE 0 END), 0) AS today
         FROM tasks
         WHERE completed_at IS NULL AND due_date IS NOT NULL`,
      )
      .get(todayDate, todayDate) as { overdue: number; today: number };
    return row;
  }

  /** Remplace intégralement les tags d'une tâche. */
  private replaceTags(taskId: string, tagIds: readonly string[]): void {
    this.db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
    if (tagIds.length === 0) return;
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)',
    );
    for (const tagId of tagIds) insert.run(taskId, tagId);
  }

  /**
   * Charge les tags de toutes les tâches en une seule requête : sans cela,
   * une liste de 200 tâches déclencherait 200 allers-retours SQLite.
   */
  private hydrate(rows: readonly TaskRow[]): Task[] {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const tagRows = this.db
      .prepare(
        `SELECT tt.task_id, g.id, g.name, g.slug, g.color
         FROM task_tags tt
         JOIN tags g ON g.id = tt.tag_id
         WHERE tt.task_id IN (${ids.map(() => '?').join(',')})
         ORDER BY g.name ASC`,
      )
      .all(...ids) as TagRow[];

    const tagsByTask = new Map<string, Tag[]>();
    for (const row of tagRows) {
      const tag: Tag = { id: row.id, name: row.name, slug: row.slug, color: row.color };
      const bucket = tagsByTask.get(row.task_id);
      if (bucket) bucket.push(tag);
      else tagsByTask.set(row.task_id, [tag]);
    }

    return rows.map((row) => toTask(row, tagsByTask.get(row.id) ?? []));
  }
}

function toTask(row: TaskRow, tags: Tag[]): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    duration: (row.duration as TaskDuration | null) ?? null,
    position: row.position,
    completedAt: row.completed_at,
    source: row.source as TaskSource,
    externalId: row.external_id,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
