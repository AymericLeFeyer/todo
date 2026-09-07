import { z } from 'zod';
import { isDateOnly } from '../domain/task/entities/due-date.js';
import { TASK_DURATIONS } from '../domain/task/entities/duration.js';

/**
 * Contrat partagé entre l'API et ses clients (PWA et intégrations comme
 * AyLabs). Les mêmes schémas valident les requêtes côté serveur et typent les
 * appels côté client : une seule source de vérité.
 */

export const dateOnlySchema = z
  .string()
  .refine(isDateOnly, { message: 'Date attendue au format YYYY-MM-DD' });

export const durationSchema = z.union([
  z.literal(TASK_DURATIONS[0]),
  z.literal(TASK_DURATIONS[1]),
  z.literal(TASK_DURATIONS[2]),
]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(500),
  notes: z.string().max(10_000).nullish(),
  dueDate: dateOnlySchema.nullish(),
  duration: durationSchema.nullish(),
  /** Noms ou slugs de tags ; les tags inconnus sont créés à la volée. */
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
  /** Clé d'idempotence fournie par l'appelant externe. */
  externalId: z.string().trim().min(1).max(128).nullish(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ completed: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à mettre à jour',
  });

export const taskStatusSchema = z.enum(['open', 'done', 'all']);
export const tagsModeSchema = z.enum(['all', 'any']);

const csvArray = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

export const listTasksQuerySchema = z.object({
  /** Filtre par tags : `?tags=aylabs,video`. */
  tags: csvArray.optional(),
  tagsMode: tagsModeSchema.default('all'),
  status: taskStatusSchema.default('open'),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  /** `true` pour ne renvoyer que les tâches sans échéance (Inbox). */
  noDate: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export const reorderSchema = z.object({
  moves: z
    .array(
      z.object({
        id: z.string().min(1),
        dueDate: dateOnlySchema.nullable(),
        position: z.number().finite(),
      }),
    )
    .min(1)
    .max(200),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type TaskStatusFilter = z.infer<typeof taskStatusSchema>;
