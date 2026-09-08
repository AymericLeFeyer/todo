import { type Task } from '@todo/core';
import { Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasks, useToggleTask } from '@/application/task/task-queries';
import { AppShell } from '@/presentation/components/layout/app-shell';
import { EmptyState } from '@/presentation/components/task/empty-state';
import { TaskItem } from '@/presentation/components/task/task-item';
import { TaskListSkeleton } from '@/presentation/components/task/task-skeleton';

/** Tâches sans échéance : la boîte de réception de ce qui n'est pas encore planifié. */
export function InboxPage() {
  const navigate = useNavigate();
  const toggle = useToggleTask();
  const { data: tasks, isPending } = useTasks({ status: 'open', noDate: true });

  // Cocher une tâche la retire de l'Inbox sur-le-champ : la liste ne montre
  // que ce qui reste à planifier. La tâche cochée par erreur se retrouve dans
  // « Terminées aujourd'hui », sur l'écran du jour, où elle se rouvre.
  const open = (tasks ?? []).filter((task) => task.completedAt === null);

  const handleToggle = (task: Task) =>
    toggle.mutate({ id: task.id, completed: task.completedAt === null });

  return (
    <AppShell title="Inbox" subtitle={open.length > 0 ? `${open.length} sans date` : undefined}>
      {isPending ? (
        <TaskListSkeleton rows={3} />
      ) : open.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-10" strokeWidth={1.25} />}
          title="Inbox vide"
          description="Les tâches créées sans échéance atterrissent ici, en attendant d'être planifiées."
        />
      ) : (
        <div className="space-y-1">
          {open.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onOpen={(t) => navigate(`/task/${t.id}`)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
