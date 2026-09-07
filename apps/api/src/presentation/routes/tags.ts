import { createTagSchema, updateTagSchema } from '@todo/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';

const idParams = z.object({ id: z.string().min(1) });

export function registerTagRoutes(app: FastifyInstance, container: Container): void {
  const { useCases } = container;

  app.get('/api/tags', async () => ({ tags: useCases.listTags.execute() }));

  app.post('/api/tags', async (request, reply) => {
    const input = createTagSchema.parse(request.body);
    return reply.code(201).send(useCases.createTag.execute(input));
  });

  app.patch('/api/tags/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.updateTag.execute(id, updateTagSchema.parse(request.body));
  });

  app.delete('/api/tags/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    useCases.deleteTag.execute(id);
    return reply.code(204).send();
  });
}
