export interface Migration {
  id: string;
  sql: string;
}

/**
 * Les migrations sont embarquées dans le code plutôt que lues depuis des
 * fichiers `.sql` : l'image Docker n'a ainsi qu'un seul artefact à packager,
 * et aucun chemin relatif à résoudre à l'exécution.
 *
 * Règle : une migration publiée n'est jamais modifiée, on en ajoute une autre.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE tasks (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        notes        TEXT,
        -- Date civile locale 'YYYY-MM-DD'. NULL = pas d'échéance (Inbox).
        due_date     TEXT,
        -- 15, 30, 60 ou NULL pour une durée indéterminée.
        duration     INTEGER,
        -- Rang fractionnaire au sein d'une journée (glisser-déposer).
        position     REAL NOT NULL,
        completed_at TEXT,
        source       TEXT NOT NULL DEFAULT 'app',
        external_id  TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );

      -- Idempotence des imports : AyLabs peut rejouer un POST sans doublon.
      CREATE UNIQUE INDEX idx_tasks_external_id
        ON tasks (external_id) WHERE external_id IS NOT NULL;
      CREATE INDEX idx_tasks_due_date ON tasks (due_date, position);
      CREATE INDEX idx_tasks_completed_at ON tasks (completed_at);

      CREATE TABLE tags (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        slug       TEXT NOT NULL UNIQUE,
        color      TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE task_tags (
        task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
        tag_id  TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      );

      CREATE INDEX idx_task_tags_tag_id ON task_tags (tag_id);

      CREATE TABLE push_subscriptions (
        id         TEXT PRIMARY KEY,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        user_agent TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE api_keys (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        key_hash     TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL,
        last_used_at TEXT
      );

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
