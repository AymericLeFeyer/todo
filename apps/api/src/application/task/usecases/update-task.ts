import { NotFoundError, nextPosition, type Task, type UpdateTaskInput } from '@todo/core';
import type { TagRepository, TaskPatch, TaskRepository } from '../../../domain/repositories.js';
import type { RecurrenceScheduler } from '../recurrence-scheduler.js';

export class UpdateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly tags: TagRepository,
    private readonly recurrences: RecurrenceScheduler,
  ) {}

  execute(id: string, input: UpdateTaskInput): Task {
    const current = this.tasks.findById(id);
    if (!current) throw new NotFoundError('Tâche', id);

    const patch: TaskPatch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    if (input.duration !== undefined) patch.duration = input.duration ?? null;
    if (input.recurrence !== undefined) patch.recurrence = input.recurrence ?? null;
    if (input.completed !== undefined) patch.completed = input.completed;

    if (input.dueDate !== undefined) {
      const dueDate = input.dueDate ?? null;
      patch.dueDate = dueDate;
      // Changer de jour, c'est changer de liste : la tâche se replace en fin
      // de la journée d'arrivée, sinon elle hériterait d'un rang arbitraire.
      if (dueDate !== current.dueDate) {
        patch.position = nextPosition(this.tasks.listByDueDate(dueDate));
      }
    }

    if (input.tags !== undefined) {
      patch.tagIds = this.tags.resolveOrCreate(input.tags ?? []).map((tag) => tag.id);
    }

    const updated = this.tasks.update(id, patch);
    if (!updated) throw new NotFoundError('Tâche', id);

    // Une intégration peut terminer une tâche par un PATCH : la répétition
    // doit se comporter comme sur `/complete`.
    const wasCompleted = current.completedAt !== null;
    if (input.completed !== undefined && input.completed !== wasCompleted) {
      if (input.completed) this.recurrences.onCompleted(updated);
      else this.recurrences.onReopened(updated);
    }

    return updated;
  }
}

export class SetTaskCompletion {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly recurrences: RecurrenceScheduler,
  ) {}

  execute(id: string, completed: boolean, now: Date = new Date()): Task {
    const updated = this.tasks.update(id, { completed });
    if (!updated) throw new NotFoundError('Tâche', id);

    if (completed) this.recurrences.onCompleted(updated, now);
    else this.recurrences.onReopened(updated);

    return updated;
  }
}

export class DeleteTask {
  constructor(private readonly tasks: TaskRepository) {}

  execute(id: string): void {
    if (!this.tasks.delete(id)) throw new NotFoundError('Tâche', id);
  }
}
