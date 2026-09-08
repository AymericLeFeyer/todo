import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task } from '@todo/core';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../config.js';
import { createContainer, type Container } from '../../container.js';
import { openDatabase } from '../../infrastructure/db/connection.js';

let app: FastifyInstance;
let container: Container;

beforeEach(async () => {
  process.env.AUTH_DISABLED = 'true';
  process.env.LOG_LEVEL = 'silent';
  container = createContainer(loadConfig(), openDatabase(':memory:'));
  app = await buildApp(container);
});

afterEach(async () => {
  await app.close();
  container.close();
});

async function createTask(body: Record<string, unknown>): Promise<Task> {
  const response = await app.inject({ method: 'POST', url: '/api/tasks', payload: body });
  expect(response.statusCode).toBeLessThan(300);
  return response.json<Task>();
}

/** Demain, au format `YYYY-MM-DD` local. */
function tomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

async function listTasks(query = ''): Promise<Task[]> {
  const response = await app.inject({ method: 'GET', url: `/api/tasks${query}` });
  expect(response.statusCode).toBe(200);
  return response.json<{ tasks: Task[] }>().tasks;
}

describe('POST /api/tasks', () => {
  it("crée une tâche sans tag ni échéance : elle atterrit dans l'Inbox", async () => {
    const task = await createTask({ title: 'Racheter du café' });

    expect(task).toMatchObject({
      title: 'Racheter du café',
      dueDate: null,
      duration: null,
      completedAt: null,
      source: 'app',
      tags: [],
    });
    expect(await listTasks('?noDate=true')).toHaveLength(1);
  });

  it('crée les tags inconnus à la volée et normalise leur slug', async () => {
    const task = await createTask({
      title: 'Monter la vidéo',
      dueDate: '2026-09-08',
      duration: 60,
      tags: ['AyLabs', 'Montage Vidéo'],
    });

    expect(task.tags.map((tag) => tag.slug)).toEqual(['aylabs', 'montage-video']);
    expect(task.duration).toBe(60);
  });

  it('refuse un titre vide et une durée hors paliers', async () => {
    const empty = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: '  ' } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error).toBe('validation_error');

    const badDuration = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Truc', duration: 45 },
    });
    expect(badDuration.statusCode).toBe(400);
  });

  it('reste idempotent quand externalId est fourni', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Publier la vidéo', externalId: 'aylabs-video-42' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Publier la vidéo (rejeu)', externalId: 'aylabs-video-42' },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json<Task>().id).toBe(first.json<Task>().id);
    expect(await listTasks()).toHaveLength(1);
  });

  it('empile les nouvelles tâches en fin de journée', async () => {
    const first = await createTask({ title: 'A', dueDate: '2026-09-08' });
    const second = await createTask({ title: 'B', dueDate: '2026-09-08' });

    expect(second.position).toBeGreaterThan(first.position);
  });
});

describe('GET /api/tasks', () => {
  beforeEach(async () => {
    await createTask({ title: 'Vidéo', dueDate: '2026-09-08', tags: ['aylabs', 'video'] });
    await createTask({ title: 'Miniature', dueDate: '2026-09-09', tags: ['aylabs'] });
    await createTask({ title: 'Courses', dueDate: '2026-09-08', tags: ['perso'] });
    await createTask({ title: 'Sans date' });
  });

  it('filtre par tags en exigeant tous les tags par défaut', async () => {
    expect((await listTasks('?tags=aylabs')).map((t) => t.title)).toEqual(['Vidéo', 'Miniature']);
    expect((await listTasks('?tags=aylabs,video')).map((t) => t.title)).toEqual(['Vidéo']);
  });

  it('bascule en union avec tagsMode=any', async () => {
    const titles = (await listTasks('?tags=video,perso&tagsMode=any')).map((t) => t.title);
    expect(titles.sort()).toEqual(['Courses', 'Vidéo']);
  });

  it('filtre par fenêtre de dates et par absence de date', async () => {
    expect((await listTasks('?from=2026-09-09&to=2026-09-09')).map((t) => t.title)).toEqual([
      'Miniature',
    ]);
    expect((await listTasks('?noDate=true')).map((t) => t.title)).toEqual(['Sans date']);
  });

  it('recherche dans le titre', async () => {
    expect((await listTasks('?search=vid')).map((t) => t.title)).toEqual(['Vidéo']);
  });

  it('masque les tâches terminées sauf demande explicite', async () => {
    const [task] = await listTasks('?search=Courses');
    await app.inject({ method: 'POST', url: `/api/tasks/${task?.id}/complete` });

    expect((await listTasks()).map((t) => t.title)).not.toContain('Courses');
    expect((await listTasks('?status=done')).map((t) => t.title)).toEqual(['Courses']);
    expect(await listTasks('?status=all')).toHaveLength(4);
  });
});

describe("cycle de vie d'une tâche", () => {
  it('bascule terminée puis à refaire', async () => {
    const task = await createTask({ title: 'Arroser les plantes', dueDate: '2026-09-08' });

    const done = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/complete` });
    expect(done.json<Task>().completedAt).not.toBeNull();

    const undone = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/uncomplete` });
    expect(undone.json<Task>().completedAt).toBeNull();
  });

  it('replace la tâche en fin de journée quand on change son échéance', async () => {
    await createTask({ title: 'Déjà là', dueDate: '2026-09-09' });
    const moving = await createTask({ title: 'Je bouge', dueDate: '2026-09-08' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${moving.id}`,
      payload: { dueDate: '2026-09-09' },
    });

    const updated = response.json<Task>();
    const day = await listTasks('?from=2026-09-09&to=2026-09-09');
    expect(updated.dueDate).toBe('2026-09-09');
    expect(day.map((t) => t.title)).toEqual(['Déjà là', 'Je bouge']);
  });

  it('remplace intégralement les tags fournis', async () => {
    const task = await createTask({ title: 'Tri', tags: ['a', 'b'] });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { tags: ['c'] },
    });
    expect(response.json<Task>().tags.map((t) => t.slug)).toEqual(['c']);
  });

  it('supprime et renvoie 404 ensuite', async () => {
    const task = await createTask({ title: 'Éphémère' });

    expect((await app.inject({ method: 'DELETE', url: `/api/tasks/${task.id}` })).statusCode).toBe(
      204,
    );
    const missing = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe('not_found');
  });
});

describe('tâches répétées', () => {
  const complete = (id: string) => app.inject({ method: 'POST', url: `/api/tasks/${id}/complete` });

  it("engendre l'occurrence suivante quand on termine la tâche", async () => {
    const task = await createTask({
      title: 'Arroser les plantes',
      dueDate: '2026-09-08',
      duration: 15,
      recurrence: 'weekly',
      tags: ['maison'],
    });

    const done = (await complete(task.id)).json<Task>();
    expect(done.completedAt).not.toBeNull();

    const open = await listTasks('?status=open');
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      title: 'Arroser les plantes',
      dueDate: '2026-09-15',
      duration: 15,
      recurrence: 'weekly',
      recurrenceParentId: task.id,
    });
    expect(open[0]?.tags.map((tag) => tag.slug)).toEqual(['maison']);
  });

  it('rattrape le retard plutôt que de reprogrammer dans le passé', async () => {
    const task = await createTask({
      title: 'Sport',
      dueDate: '2020-01-01',
      recurrence: 'daily',
    });

    await complete(task.id);
    const [next] = await listTasks('?status=open');
    expect(next?.dueDate).toBe(tomorrowDate());
  });

  it("retire l'occurrence engendrée si l'on rouvre la tâche cochée par erreur", async () => {
    const task = await createTask({
      title: 'Facture',
      dueDate: '2026-09-08',
      recurrence: 'monthly',
    });

    await complete(task.id);
    expect(await listTasks('?status=open')).toHaveLength(1);

    await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/uncomplete` });
    const open = await listTasks('?status=open');
    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe(task.id);
  });

  it("ne produit qu'une occurrence même si l'on termine deux fois", async () => {
    const task = await createTask({
      title: 'Poubelles',
      dueDate: '2026-09-08',
      recurrence: 'weekly',
    });

    await complete(task.id);
    await complete(task.id);

    expect(await listTasks('?status=open')).toHaveLength(1);
  });

  it('ne reproduit pas une tâche répétée restée sans échéance', async () => {
    const task = await createTask({ title: 'Un jour peut-être', recurrence: 'daily' });

    await complete(task.id);

    expect(await listTasks('?status=open')).toHaveLength(0);
  });
});

describe('GET /api/tasks?completedFrom', () => {
  it('ne renvoie que ce qui a été terminé depuis la borne', async () => {
    const task = await createTask({ title: 'Rangement', dueDate: '2026-09-08' });
    await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/complete` });

    const since = new Date(Date.now() - 60_000).toISOString();
    const later = new Date(Date.now() + 60_000).toISOString();

    expect(await listTasks(`?status=done&completedFrom=${since}`)).toHaveLength(1);
    expect(await listTasks(`?status=done&completedFrom=${later}`)).toHaveLength(0);
  });
});

describe('POST /api/tasks/reorder', () => {
  it('déplace une tâche vers un autre jour à la position demandée', async () => {
    const a = await createTask({ title: 'A', dueDate: '2026-09-08' });
    const b = await createTask({ title: 'B', dueDate: '2026-09-09' });
    const c = await createTask({ title: 'C', dueDate: '2026-09-09' });

    // « A » passe au 9, intercalé entre B et C.
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/reorder',
      payload: {
        moves: [{ id: a.id, dueDate: '2026-09-09', position: (b.position + c.position) / 2 }],
      },
    });

    expect(response.statusCode).toBe(200);
    const day = await listTasks('?from=2026-09-09&to=2026-09-09');
    expect(day.map((t) => t.title)).toEqual(['B', 'A', 'C']);
    expect(await listTasks('?from=2026-09-08&to=2026-09-08')).toHaveLength(0);
  });

  it('réindexe une journée dont les positions deviennent trop serrées', async () => {
    const a = await createTask({ title: 'A', dueDate: '2026-09-08' });
    const b = await createTask({ title: 'B', dueDate: '2026-09-08' });

    await app.inject({
      method: 'POST',
      url: '/api/tasks/reorder',
      payload: {
        moves: [
          { id: a.id, dueDate: '2026-09-08', position: 1 },
          { id: b.id, dueDate: '2026-09-08', position: 1 + 1e-9 },
        ],
      },
    });

    const day = await listTasks('?from=2026-09-08&to=2026-09-08');
    expect(day.map((t) => t.title)).toEqual(['A', 'B']);
    expect((day[1]?.position ?? 0) - (day[0]?.position ?? 0)).toBeGreaterThan(1);
  });
});
