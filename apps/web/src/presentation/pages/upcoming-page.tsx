import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { buildAgenda, positionForIndex, type DateOnly, type Task } from '@todo/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useReorderTasks, useTasks, useToggleTask } from '@/application/task/task-queries';
import { AppShell } from '@/presentation/components/layout/app-shell';
import { DAY_DROPPABLE_PREFIX, DaySection } from '@/presentation/components/task/day-section';
import { SortableTaskItem } from '@/presentation/components/task/sortable-task-item';
import { TaskItem } from '@/presentation/components/task/task-item';
import { TaskListSkeleton } from '@/presentation/components/task/task-skeleton';
import { useInfiniteDays } from '@/presentation/hooks/use-infinite-days';

/**
 * Agenda vertical continu : une section par jour, du jour même jusqu'au bout
 * du défilement, précédée du retard. Les tâches se déplacent d'un jour à
 * l'autre au glisser-déposer.
 */
export function UpcomingPage() {
  const navigate = useNavigate();
  const { from, to, sentinelRef } = useInfiniteDays();
  const toggle = useToggleTask();
  const reorder = useReorderTasks();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // `to` sans `from` ramène aussi le retard : il se range en tête de l'agenda.
  const { data: tasks, isPending } = useTasks({ status: 'open', to });
  const agenda = useMemo(() => buildAgenda(tasks ?? [], from, to), [tasks, from, to]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Appui long avant de saisir : sans ce délai, le moindre défilement au
      // pouce arracherait une tâche au lieu de faire défiler la liste.
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleToggle = (task: Task) =>
    toggle.mutate({ id: task.id, completed: task.completedAt === null });

  const handleDragStart = (event: DragStartEvent) => {
    const all = [...agenda.overdue, ...agenda.days.flatMap((day) => day.tasks)];
    setDraggedTask(all.find((task) => task.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = draggedTask;
    setDraggedTask(null);

    const over = event.over;
    if (!active || !over) return;

    const target = resolveDropTarget(String(over.id), agenda.days);
    if (!target) return;

    const { date, tasks: dayTasks, index } = target;
    if (date === active.dueDate && dayTasks[index]?.id === active.id) return;

    reorder.mutate(
      {
        moves: [
          { id: active.id, dueDate: date, position: positionForIndex(dayTasks, index, active.id) },
        ],
      },
      { onError: () => toast.error('Déplacement non enregistré') },
    );
  };

  return (
    <AppShell title="Agenda" subtitle="Glisse une tâche pour la déplacer d'un jour à l'autre">
      {isPending ? (
        <TaskListSkeleton rows={6} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedTask(null)}
        >
          <div className="space-y-5">
            {agenda.overdue.length > 0 && (
              <section>
                <h2 className="px-1 pb-1.5 text-sm font-semibold text-destructive">
                  En retard · {agenda.overdue.length}
                </h2>
                {/* Déplaçables aussi : repousser un retard à aujourd'hui est
                    le geste le plus fréquent de l'agenda. */}
                <SortableContext
                  items={agenda.overdue.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {agenda.overdue.map((task) => (
                      <SortableTaskItem
                        key={task.id}
                        task={task}
                        showDate
                        onToggle={handleToggle}
                        onOpen={(t) => navigate(`/task/${t.id}`)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </section>
            )}

            {agenda.days.map((day) => (
              <DaySection
                key={day.date}
                date={day.date}
                tasks={day.tasks}
                onToggle={handleToggle}
                onOpen={(task) => navigate(`/task/${task.id}`)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-8" aria-hidden />

          <DragOverlay dropAnimation={null}>
            {draggedTask && (
              <TaskItem
                task={draggedTask}
                onToggle={() => {}}
                className="cursor-grabbing shadow-xl ring-1 ring-primary/40"
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </AppShell>
  );
}

interface DropTarget {
  date: DateOnly;
  tasks: Task[];
  index: number;
}

/**
 * Traduit la cible de dnd-kit en (jour, index d'insertion).
 *
 * L'index est celui de la tâche survolée dans la liste complète du jour ;
 * `positionForIndex` exclut ensuite la tâche déplacée, ce qui donne le bon
 * résultat aussi bien vers le haut que vers le bas.
 */
function resolveDropTarget(
  overId: string,
  days: Array<{ date: DateOnly; tasks: Task[] }>,
): DropTarget | null {
  if (overId.startsWith(DAY_DROPPABLE_PREFIX)) {
    const date = overId.slice(DAY_DROPPABLE_PREFIX.length);
    const day = days.find((item) => item.date === date);
    return day ? { date: day.date, tasks: day.tasks, index: day.tasks.length } : null;
  }

  for (const day of days) {
    const index = day.tasks.findIndex((task) => task.id === overId);
    if (index !== -1) return { date: day.date, tasks: day.tasks, index };
  }

  return null;
}
