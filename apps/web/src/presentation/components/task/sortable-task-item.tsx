import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@todo/core';
import { GripVertical } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { TaskItem, type TaskItemProps } from './task-item';

export type SortableTaskItemProps = TaskItemProps & { task: Task };

/**
 * Tâche déplaçable. Toute la ligne sert de poignée : sur mobile, l'appui long
 * déclenche le déplacement (voir la contrainte d'activation du DndContext),
 * donc un simple appui reste réservé à l'ouverture de la fiche. La poignée
 * visible n'a pas ses propres écouteurs — elle ne fait qu'indiquer que la
 * ligne entière se glisse, souris comme tactile.
 * `touch-action: manipulation` (par défaut, non modifié ici) laisse le
 * scroll vertical au navigateur ; dnd-kit ne prend la main qu'après le délai
 * d'appui long sur tactile, ou un léger déplacement à la souris.
 */
export function SortableTaskItem({ task, ...props }: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', dueDate: task.dueDate },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group/drag relative', isDragging ? 'z-10 cursor-grabbing' : 'cursor-grab')}
      {...attributes}
      {...listeners}
    >
      <TaskItem task={task} isDragging={isDragging} {...props} className="pr-9" />
      <GripVertical
        className={cn(
          'pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50 transition-opacity',
          isDragging ? 'opacity-100' : 'opacity-70 group-hover/drag:opacity-100',
        )}
        aria-hidden
      />
    </div>
  );
}
