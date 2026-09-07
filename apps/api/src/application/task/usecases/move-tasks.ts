import {
  needsRebalance,
  rebalance,
  today,
  type DateOnly,
  type ListTasksQuery,
  type ReorderInput,
  type Task,
  type TodayStats,
} from '@todo/core';
import type { TaskMove, TaskRepository } from '../../../domain/repositories.js';

export class MoveTasks {
  constructor(private readonly tasks: TaskRepository) {}

  /**
   * Applique un lot de déplacements issus du glisser-déposer, puis réindexe
   * les journées dont les positions sont devenues trop serrées.
   *
   * Le client calcule lui-même les positions (le code de calcul vit dans
   * `@todo/core`, partagé) : l'interface reste instantanée, le serveur ne fait
   * qu'entériner et garder les rangs exploitables sur la durée.
   */
  execute(input: ReorderInput): Task[] {
    const moved = this.tasks.move(input.moves);

    const touchedDays = new Set<DateOnly | null>(input.moves.map((move) => move.dueDate));
    const corrections: TaskMove[] = [];

    for (const day of touchedDays) {
      const dayTasks = this.tasks.listByDueDate(day);
      if (!needsRebalance(dayTasks)) continue;
      for (const { id, position } of rebalance(dayTasks)) {
        corrections.push({ id, dueDate: day, position });
      }
    }

    return corrections.length > 0 ? this.tasks.move(corrections) : moved;
  }
}

export class ListTasks {
  constructor(private readonly tasks: TaskRepository) {}

  execute(query: ListTasksQuery): Task[] {
    return this.tasks.list({
      tags: query.tags,
      tagsMode: query.tagsMode,
      status: query.status,
      from: query.from,
      to: query.to,
      noDate: query.noDate,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }
}

export class GetTodayStats {
  constructor(private readonly tasks: TaskRepository) {}

  execute(now: Date = new Date()): TodayStats {
    const counts = this.tasks.countForBadge(today(now));
    return {
      overdue: counts.overdue,
      today: counts.today,
      // La pastille agrège retard et jour courant : c'est le nombre de choses
      // qui réclament une action aujourd'hui.
      badge: counts.overdue + counts.today,
    };
  }
}
