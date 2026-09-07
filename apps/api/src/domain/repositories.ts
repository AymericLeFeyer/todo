import type { DateOnly, Tag, Task, TaskDuration, TaskSource } from '@todo/core';

/** Critères de recherche acceptés par `GET /api/tasks`. */
export interface TaskFilters {
  tags?: string[];
  tagsMode: 'all' | 'any';
  status: 'open' | 'done' | 'all';
  from?: DateOnly;
  to?: DateOnly;
  /** Ne renvoyer que les tâches sans échéance (Inbox). */
  noDate?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export interface NewTask {
  id: string;
  title: string;
  notes: string | null;
  dueDate: DateOnly | null;
  duration: TaskDuration | null;
  position: number;
  source: TaskSource;
  externalId: string | null;
  tagIds: string[];
}

/** Champs modifiables ; `undefined` signifie « ne pas toucher ». */
export interface TaskPatch {
  title?: string;
  notes?: string | null;
  dueDate?: DateOnly | null;
  duration?: TaskDuration | null;
  position?: number;
  completed?: boolean;
  tagIds?: string[];
}

export interface TaskMove {
  id: string;
  dueDate: DateOnly | null;
  position: number;
}

export interface TaskCounts {
  overdue: number;
  today: number;
}

export interface TaskRepository {
  findById(id: string): Task | null;
  findByExternalId(externalId: string): Task | null;
  list(filters: TaskFilters): Task[];
  /** Tâches non terminées d'une journée, triées par position. Sert au calcul des rangs. */
  listByDueDate(dueDate: DateOnly | null): Task[];
  create(task: NewTask): Task;
  update(id: string, patch: TaskPatch): Task | null;
  delete(id: string): boolean;
  /** Déplace plusieurs tâches en une transaction (glisser-déposer). */
  move(moves: readonly TaskMove[]): Task[];
  countForBadge(todayDate: DateOnly): TaskCounts;
}

export interface TagRepository {
  findAll(): Tag[];
  findBySlug(slug: string): Tag | null;
  /** Résout des noms ou slugs en tags, en créant ceux qui n'existent pas encore. */
  resolveOrCreate(names: readonly string[]): Tag[];
  create(name: string, color?: string): Tag;
  update(id: string, patch: { name?: string; color?: string }): Tag | null;
  delete(id: string): boolean;
  /** Nombre de tâches non terminées par slug de tag. */
  countsBySlug(): Record<string, number>;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionRepository {
  findAll(): PushSubscriptionRecord[];
  save(subscription: PushSubscriptionRecord & { userAgent?: string | null }): void;
  deleteByEndpoint(endpoint: string): boolean;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyRepository {
  findAll(): ApiKeyRecord[];
  /** Retourne la clé correspondant au hash et met à jour sa date d'utilisation. */
  useByHash(keyHash: string): ApiKeyRecord | null;
  create(name: string, keyHash: string): ApiKeyRecord;
  delete(id: string): boolean;
}
