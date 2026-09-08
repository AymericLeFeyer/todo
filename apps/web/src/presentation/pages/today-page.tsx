import {
  estimatedMinutes,
  fromDateOnly,
  isCompletedOn,
  isDueToday,
  isOverdue,
  today,
  type Task,
} from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks, useToggleTask } from '@/application/task/task-queries';
import { AppShell } from '@/presentation/components/layout/app-shell';
import { EmptyState } from '@/presentation/components/task/empty-state';
import { TaskItem } from '@/presentation/components/task/task-item';
import { TaskListSkeleton } from '@/presentation/components/task/task-skeleton';

export function TodayPage() {
  const todayDate = today();
  const navigate = useNavigate();
  const toggle = useToggleTask();

  // Tout ce qui est dû aujourd'hui ou avant : le retard fait partie de la
  // journée, il ne doit pas rester invisible dans une vue passée.
  const { data: tasks, isPending } = useTasks({ status: 'open', to: todayDate });

  // Le bilan du jour se lit sur la date de complétion, pas sur l'échéance :
  // une tâche de l'Inbox ou un retard cochés aujourd'hui comptent aussi.
  const { data: doneToday } = useTasks({
    status: 'done',
    completedFrom: fromDateOnly(todayDate).toISOString(),
  });

  // Une tâche rouverte depuis la section « terminées » n'est pas encore dans
  // la liste ouverte : on fusionne les deux sources dans les deux sens, sinon
  // elle disparaîtrait de l'écran le temps d'un aller-retour réseau.
  const open = useMemo(
    () => mergeOpen(tasks ?? [], doneToday ?? [], todayDate),
    [tasks, doneToday, todayDate],
  );
  const overdue = open.filter((task) => isOverdue(task, todayDate));
  const dueToday = open.filter((task) => task.dueDate === todayDate);
  const total = overdue.length + dueToday.length;
  const minutes = estimatedMinutes([...overdue, ...dueToday]);

  // On complète la liste terminée avec les cases cochées à l'instant : leur
  // mise à jour est optimiste, la requête « done » ne les connaît pas encore.
  const completed = useMemo(
    () => mergeCompleted(doneToday ?? [], tasks ?? [], todayDate),
    [doneToday, tasks, todayDate],
  );

  const handleToggle = (task: Task) =>
    toggle.mutate({ id: task.id, completed: task.completedAt === null });

  return (
    <AppShell
      title="Aujourd'hui"
      newTaskQuery={`?date=${todayDate}`}
      subtitle={
        <span className="capitalize">
          {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          {total > 0 && (
            <span className="normal-case">
              {' · '}
              {total} tâche{total > 1 ? 's' : ''}
              {minutes > 0 && ` · ${formatEstimate(minutes)}`}
            </span>
          )}
        </span>
      }
    >
      {isPending ? (
        <TaskListSkeleton />
      ) : total === 0 && completed.length === 0 ? (
        <EmptyState
          title="Journée dégagée"
          description="Rien à faire aujourd'hui. Ajoute une tâche ou profite du calme."
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="px-1 pb-1.5 text-sm font-semibold text-destructive">
                En retard · {overdue.length}
              </h2>
              <div className="space-y-1">
                {overdue.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    showDate
                    onToggle={handleToggle}
                    onOpen={(t) => navigate(`/task/${t.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {dueToday.length > 0 && (
            <section>
              {overdue.length > 0 && (
                <h2 className="px-1 pb-1.5 text-sm font-semibold text-muted-foreground">
                  Aujourd'hui
                </h2>
              )}
              <div className="space-y-1">
                {dueToday.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onOpen={(t) => navigate(`/task/${t.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {total === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Tout est fait pour aujourd'hui.
            </p>
          )}

          {/* Le bilan du jour, et le filet de sécurité : une case cochée par
              erreur se décoche ici, la tâche revient à sa place. */}
          {completed.length > 0 && (
            <section>
              <h2 className="px-1 pb-1.5 text-sm font-semibold text-muted-foreground">
                Terminées aujourd'hui · {completed.length}
              </h2>
              <div className="space-y-1 opacity-70">
                {completed.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    showDate
                    onToggle={handleToggle}
                    onOpen={(t) => navigate(`/task/${t.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

/** Tâches à faire aujourd'hui (retard compris), quelle que soit leur source. */
function mergeOpen(lists: readonly Task[], reopened: readonly Task[], date: string): Task[] {
  const byId = new Map<string, Task>();
  for (const task of [...lists, ...reopened]) {
    if (isDueToday(task, date)) byId.set(task.id, task);
  }
  return [...byId.values()];
}

/**
 * Fusionne les tâches terminées connues du serveur et celles que l'on vient
 * de cocher, les plus récentes d'abord. Sans cette fusion, une case cochée
 * disparaîtrait de l'écran le temps d'un aller-retour réseau avant de
 * réapparaître plus bas.
 */
function mergeCompleted(done: readonly Task[], candidates: readonly Task[], date: string): Task[] {
  const byId = new Map<string, Task>();
  for (const task of done) if (isCompletedOn(task, date)) byId.set(task.id, task);
  for (const task of candidates) if (isCompletedOn(task, date)) byId.set(task.id, task);

  return [...byId.values()].sort((a, b) =>
    (a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1,
  );
}

/** « 90 » devient « 1 h 30 » : plus lisible pour juger d'une journée. */
function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}
