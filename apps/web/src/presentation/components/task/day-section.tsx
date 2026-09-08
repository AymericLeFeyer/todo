import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { fromDateOnly, isWeekend, relativeDayLabel, type DateOnly, type Task } from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { useOpenNewTask } from '@/presentation/hooks/use-new-task';
import { cn } from '@/shared/lib/utils';
import { SortableTaskItem } from './sortable-task-item';

export const DAY_DROPPABLE_PREFIX = 'day:';

export interface DaySectionProps {
  date: DateOnly;
  tasks: Task[];
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

/**
 * Une journée de l'agenda. La zone reste déposable même vide : c'est ce qui
 * permet de repousser une tâche à un jour où il n'y a encore rien.
 */
export function DaySection({ date, tasks, onToggle, onOpen }: DaySectionProps) {
  const openNewTask = useOpenNewTask();
  const { setNodeRef, isOver } = useDroppable({
    id: `${DAY_DROPPABLE_PREFIX}${date}`,
    data: { type: 'day', date },
  });

  const label = relativeDayLabel(date);
  const parsed = fromDateOnly(date);

  return (
    <section ref={setNodeRef} className="scroll-mt-16">
      <header className="sticky top-[var(--app-header-height,3.5rem)] z-20 -mx-3 flex items-baseline gap-2 bg-background/90 px-4 py-1.5 backdrop-blur">
        <h2
          className={cn(
            'text-sm font-semibold',
            label === "Aujourd'hui" ? 'text-primary' : 'text-foreground',
          )}
        >
          {label ?? format(parsed, 'EEEE d MMMM', { locale: fr })}
        </h2>
        {label && (
          <span className="text-xs text-muted-foreground">
            {format(parsed, 'd MMMM', { locale: fr })}
          </span>
        )}
        {isWeekend(date) && !label && (
          <span className="text-xs text-muted-foreground">week-end</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{tasks.length || ''}</span>
      </header>

      <div
        className={cn(
          'min-h-11 space-y-1 rounded-xl transition-colors',
          isOver && 'bg-primary/10 ring-1 ring-primary/40',
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskItem key={task.id} task={task} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <button
            type="button"
            // Bouton et non lien : le clavier doit se lever dans le geste même
            // du tap (cf. use-new-task).
            onClick={() => openNewTask(`?date=${date}`)}
            className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
            Ajouter une tâche
          </button>
        )}
      </div>
    </section>
  );
}
