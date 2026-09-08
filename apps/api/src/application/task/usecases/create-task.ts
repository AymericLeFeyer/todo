import { nextPosition, uuidv7, type CreateTaskInput, type Task, type TaskSource } from '@todo/core';
import type { TagRepository, TaskRepository } from '../../../domain/repositories.js';

export interface CreateTaskResult {
  task: Task;
  /** `false` quand la tâche existait déjà pour cet `externalId`. */
  created: boolean;
}

export class CreateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly tags: TagRepository,
  ) {}

  execute(input: CreateTaskInput, source: TaskSource = 'app'): CreateTaskResult {
    // Idempotence : AyLabs peut rejouer un POST (retry réseau, relance de job)
    // sans créer de doublon, à condition de fournir un externalId stable.
    if (input.externalId) {
      const existing = this.tasks.findByExternalId(input.externalId);
      if (existing) return { task: existing, created: false };
    }

    const resolvedTags = input.tags?.length ? this.tags.resolveOrCreate(input.tags) : [];
    const dueDate = input.dueDate ?? null;

    const task = this.tasks.create({
      id: uuidv7(),
      title: input.title,
      notes: input.notes ?? null,
      dueDate,
      duration: input.duration ?? null,
      recurrence: input.recurrence ?? null,
      recurrenceParentId: null,
      // Une nouvelle tâche se pose en fin de journée, comme dans Todoist.
      position: nextPosition(this.tasks.listByDueDate(dueDate)),
      source,
      externalId: input.externalId ?? null,
      tagIds: resolvedTags.map((tag) => tag.id),
    });

    return { task, created: true };
  }
}
