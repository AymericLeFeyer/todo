import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task, TodayStats } from '@todo/core';
import { today } from '@todo/core';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../config.js';
import { createContainer, type Container } from '../../container.js';
import { openDatabase } from '../../infrastructure/db/connection.js';

let app: FastifyInstance;
let container: Container;

beforeEach(async () => {
  process.env.LOG_LEVEL = 'silent';
  delete process.env.AUTH_DISABLED;
  process.env.APP_PASSWORD = 'motdepasse-de-test';
  process.env.SESSION_SECRET = 'secret-de-test';

  container = createContainer(loadConfig(), openDatabase(':memory:'));
  app = await buildApp(container);
});

afterEach(async () => {
  delete process.env.APP_PASSWORD;
  await app.close();
  container.close();
});

describe('authentification', () => {
  it('refuse une requête sans identifiant quand un mot de passe est configuré', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('unauthorized');
  });

  it('laisse passer le health check et le login', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    const status = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(status.json()).toMatchObject({ authRequired: true, authenticated: false });
  });

  it('ouvre une session par mot de passe et la rejette si incorrect', async () => {
    const refus = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'mauvais' },
    });
    expect(refus.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'motdepasse-de-test' },
    });
    expect(login.statusCode).toBe(200);

    const cookie = login.cookies[0];
    const authorized = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      cookies: { [cookie?.name as string]: cookie?.value as string },
    });
    expect(authorized.statusCode).toBe(200);
  });

  it("accepte une clé API valide et marque la tâche comme venant de l'API", async () => {
    // La clé est créée via une session authentifiée, puis rejouée seule.
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'motdepasse-de-test' },
    });
    const cookie = login.cookies[0];
    const cookies = { [cookie?.name as string]: cookie?.value as string };

    const created = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      payload: { name: 'AyLabs' },
      cookies,
    });
    const key = created.json<{ key: string }>().key;
    expect(key).toMatch(/^todo_/);

    const rejected = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { 'x-api-key': 'todo_fausse-cle' },
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.json().error).toBe('invalid_api_key');

    const task = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Depuis AyLabs', tags: ['aylabs'] },
      headers: { 'x-api-key': key },
    });
    expect(task.statusCode).toBe(201);
    expect(task.json<Task>().source).toBe('api');
  });
});

describe('GET /api/stats/today', () => {
  it('compte le retard et le jour courant pour la pastille', async () => {
    const cookies = await authenticate(app);
    const post = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/tasks', payload, cookies });

    await post({ title: 'En retard', dueDate: '2020-01-01' });
    await post({ title: "Aujourd'hui", dueDate: today() });
    await post({ title: 'Plus tard', dueDate: '2099-01-01' });
    await post({ title: 'Sans date' });

    const stats = await app.inject({ method: 'GET', url: '/api/stats/today', cookies });
    expect(stats.json<TodayStats>()).toEqual({ overdue: 1, today: 1, badge: 2 });
  });
});

async function authenticate(instance: FastifyInstance): Promise<Record<string, string>> {
  const login = await instance.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: 'motdepasse-de-test' },
  });
  const cookie = login.cookies[0];
  return { [cookie?.name as string]: cookie?.value as string };
}
