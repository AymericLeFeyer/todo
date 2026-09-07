import { uuidv7 } from '@todo/core';
import type { Db } from '../db/connection.js';
import type {
  ApiKeyRecord,
  ApiKeyRepository,
  PushSubscriptionRecord,
  PushSubscriptionRepository,
} from '../../domain/repositories.js';

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export class SqlitePushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly db: Db) {}

  findAll(): PushSubscriptionRecord[] {
    const rows = this.db
      .prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions')
      .all() as SubscriptionRow[];
    return rows.map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }));
  }

  save(subscription: PushSubscriptionRecord & { userAgent?: string | null }): void {
    // Un même appareil qui se réabonne conserve une seule ligne : Safari
    // renouvelle l'endpoint régulièrement, on écrase donc sur conflit.
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      )
      .run(
        subscription.id,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        subscription.userAgent ?? null,
        new Date().toISOString(),
      );
  }

  deleteByEndpoint(endpoint: string): boolean {
    return (
      this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint).changes > 0
    );
  }
}

interface ApiKeyRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export class SqliteApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: Db) {}

  findAll(): ApiKeyRecord[] {
    const rows = this.db
      .prepare('SELECT id, name, created_at, last_used_at FROM api_keys ORDER BY created_at DESC')
      .all() as ApiKeyRow[];
    return rows.map(toApiKey);
  }

  useByHash(keyHash: string): ApiKeyRecord | null {
    const row = this.db
      .prepare('SELECT id, name, created_at, last_used_at FROM api_keys WHERE key_hash = ?')
      .get(keyHash) as ApiKeyRow | undefined;
    if (!row) return null;

    this.db
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .run(new Date().toISOString(), row.id);
    return toApiKey(row);
  }

  create(name: string, keyHash: string): ApiKeyRecord {
    const record: ApiKeyRecord = {
      id: uuidv7(),
      name,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    this.db
      .prepare('INSERT INTO api_keys (id, name, key_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(record.id, record.name, keyHash, record.createdAt);
    return record;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0;
  }
}

function toApiKey(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}
