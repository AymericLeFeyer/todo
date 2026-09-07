import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(48),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue, ex. #3b82f6')
    .optional(),
});

export const updateTagSchema = createTagSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à mettre à jour' });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
