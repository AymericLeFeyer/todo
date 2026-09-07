import {
  createTaskSchema,
  listTasksQuerySchema,
  reorderSchema,
  updateTaskSchema,
  NotFoundError,
} from '@todo/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';

const idParams = z.object({ id: z.string().min(1) });

export function registerTaskRoutes(app: FastifyInstance, container: Container): void {
  const { useCases, repositories, notifier } = container;

  app.get('/api/tasks', async (request) => {
    const query = listTasksQuerySchema.parse(request.query);
    return { tasks: useCases.listTasks.execute(query) };
  });

  app.get('/api/tasks/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const task = repositories.tasks.findById(id);
    if (!task) throw new NotFoundError('Tâche', id);
    return task;
  });

  app.post('/api/tasks', async (request, reply) => {
    const input = createTaskSchema.parse(request.body);
    const source = request.auth.kind === 'api-key' ? 'api' : 'app';
    const { task, created } = useCases.createTask.execute(input, source);

    // Une tâche déposée par une intégration pour aujourd'hui doit faire bouger
    // la pastille tout de suite : sans push, elle attendrait la prochaine
    // ouverture de l'app.
    if (created && source === 'api') {
      notifier.notifyExternalTask(task).catch((error) => {
        request.log.warn({ err: error }, 'Notification de tâche externe échouée');
      });
    }

    return reply.code(created ? 201 : 200).send(task);
  });

  app.patch('/api/tasks/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const input = updateTaskSchema.parse(request.body);
    return useCases.updateTask.execute(id, input);
  });

  app.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    useCases.deleteTask.execute(id);
    return reply.code(204).send();
  });

  app.post('/api/tasks/:id/complete', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.setTaskCompletion.execute(id, true);
  });

  app.post('/api/tasks/:id/uncomplete', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.setTaskCompletion.execute(id, false);
  });

  app.post('/api/tasks/reorder', async (request) => {
    const input = reorderSchema.parse(request.body);
    return { tasks: useCases.moveTasks.execute(input) };
  });
}
