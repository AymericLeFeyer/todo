import type { Task } from '@todo/core';
import { ChevronRight, Hash } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTags } from '@/application/tag/tag-queries';
import { useTasks, useToggleTask } from '@/application/task/task-queries';
import { AppShell } from '@/presentation/components/layout/app-shell';
import { EmptyState } from '@/presentation/components/task/empty-state';
import { TaskItem } from '@/presentation/components/task/task-item';
import { TaskListSkeleton } from '@/presentation/components/task/task-skeleton';
import { useOpenNewTask } from '@/presentation/hooks/use-new-task';

/** Liste des tags avec leur charge de travail en cours. */
export function TagsPage() {
  const { data: tags, isPending } = useTags();

  return (
    <AppShell title="Tags">
      {isPending ? (
        <TaskListSkeleton rows={4} />
      ) : (tags?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Hash className="size-10" strokeWidth={1.25} />}
          title="Aucun tag"
          description="Les tags se créent à la volée en tapant #nom dans le titre d'une tâche."
        />
      ) : (
        <ul className="space-y-1">
          {tags?.map((tag) => (
            <li key={tag.id}>
              <Link
                to={`/tags/${tag.slug}`}
                className="flex items-center gap-3 rounded-xl bg-card px-3 py-3 transition-colors hover:bg-accent"
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate">{tag.name}</span>
                <span className="text-sm text-muted-foreground">{tag.openTasks || '—'}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

/**
 * Tâches d'un tag. C'est la vue miroir de `GET /api/tasks?tags=<slug>` :
 * ce qu'AyLabs lit par l'API se retrouve tel quel ici.
 */
export function TagTasksPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const toggle = useToggleTask();
  const openNewTask = useOpenNewTask();
  const { data: tags } = useTags();
  const { data: tasks, isPending } = useTasks(
    { status: 'open', tags: slug ? [slug] : [] },
    Boolean(slug),
  );

  const tag = tags?.find((item) => item.slug === slug);

  const handleToggle = (task: Task) =>
    toggle.mutate({ id: task.id, completed: task.completedAt === null });

  return (
    <AppShell
      title={tag?.name ?? slug ?? 'Tag'}
      subtitle={tasks ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} en cours` : undefined}
      newTaskQuery={`?tag=${slug}`}
      actions={
        <button
          type="button"
          onClick={() => openNewTask(`?tag=${slug}`)}
          className="rounded-lg px-3 py-1.5 text-sm text-primary hover:bg-accent"
        >
          Ajouter
        </button>
      }
    >
      {isPending ? (
        <TaskListSkeleton rows={3} />
      ) : (tasks?.length ?? 0) === 0 ? (
        <EmptyState title="Rien ici" description="Aucune tâche en cours pour ce tag." />
      ) : (
        <div className="space-y-1">
          {tasks?.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              showDate
              onToggle={handleToggle}
              onOpen={(item) => navigate(`/task/${item.id}`)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
