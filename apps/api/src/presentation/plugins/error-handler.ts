import { DomainError } from '@todo/core';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/**
 * Traduit les erreurs en réponses JSON stables : les intégrations doivent
 * pouvoir se fier au champ `error` plutôt qu'au libellé, qui reste humain.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'Requête invalide',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof DomainError) {
      return reply.code(error.status).send({ error: error.code, message: error.message });
    }

    if (error.validation) {
      return reply.code(400).send({ error: 'validation_error', message: error.message });
    }

    request.log.error({ err: error }, 'Erreur non gérée');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.code(status).send({
      error: 'internal_error',
      message: status === 500 ? 'Erreur interne' : error.message,
    });
  });
}
