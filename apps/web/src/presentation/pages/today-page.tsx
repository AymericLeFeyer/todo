import { estimatedMinutes, isOverdue, today, type Task } from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

  const overdue = (tasks ?? []).filter((task) => isOverdue(task, todayDate));
  const dueToday = (tasks ?? []).filter((task) => task.dueDate === todayDate);
  const total = overdue.length + dueToday.length;
  const minutes = estimatedMinutes([...overdue, ...dueToday]);

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
      ) : total === 0 ? (
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
        </div>
      )}
    </AppShell>
  );
}

/** « 90 » devient « 1 h 30 » : plus lisible pour juger d'une journée. */
function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}
