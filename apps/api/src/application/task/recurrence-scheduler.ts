import { nextOccurrence, nextPosition, today, uuidv7, type Task } from '@todo/core';
import type { TaskRepository } from '../../domain/repositories.js';

/**
 * Entretient la chaîne des occurrences d'une tâche répétée.
 *
 * Le parti pris : terminer une occurrence en crée une nouvelle plutôt que de
 * repousser la même ligne. La tâche cochée reste donc visible dans le « fait
 * aujourd'hui », et l'agenda porte déjà la suivante. Rouvrir une occurrence
 * cochée par erreur retire celle qu'elle avait engendrée — sinon la case
 * décochée laisserait un doublon dans l'agenda.
 */
export class RecurrenceScheduler {
  constructor(private readonly tasks: TaskRepository) {}

  onCompleted(task: Task, now: Date = new Date()): void {
    // Sans échéance, une répétition n'a aucun point de départ : la tâche reste
    // dans l'Inbox et ne se reproduit pas.
    if (task.recurrence === null || task.dueDate === null) return;
    // Deux « terminer » de suite ne doivent pas produire deux occurrences.
    if (this.tasks.findByRecurrenceParent(task.id) !== null) return;

    // `today(now)` sert de plancher : terminer aujourd'hui une tâche
    // quotidienne oubliée depuis une semaine la reprogramme demain, pas dans
    // le passé — elle renaîtrait sinon immédiatement en retard.
    const dueDate = nextOccurrence(task.dueDate, task.recurrence, today(now));

    this.tasks.create({
      id: uuidv7(),
      title: task.title,
      notes: task.notes,
      dueDate,
      duration: task.duration,
      position: nextPosition(this.tasks.listByDueDate(dueDate)),
      recurrence: task.recurrence,
      recurrenceParentId: task.id,
      source: task.source,
      // L'idempotence appartient à l'occurrence d'origine : reconduire son
      // `externalId` ferait échouer l'index unique.
      externalId: null,
      tagIds: task.tags.map((tag) => tag.id),
    });
  }

  onReopened(task: Task): void {
    const spawned = this.tasks.findByRecurrenceParent(task.id);
    // Une occurrence déjà terminée appartient à l'historique : on n'y touche pas.
    if (spawned && spawned.completedAt === null) this.tasks.delete(spawned.id);
  }
}
