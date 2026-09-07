import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@todo/core';
import { TaskItem, type TaskItemProps } from './task-item';

export type SortableTaskItemProps = TaskItemProps & { task: Task };

/**
 * Tâche déplaçable. Tout l'élément sert de poignée : sur mobile, l'appui long
 * déclenche le déplacement (voir la contrainte d'activation du DndContext),
 * donc un simple appui reste réservé à l'ouverture de la fiche.
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
      className={isDragging ? 'relative z-10' : undefined}
      // `touch-action: manipulation` laisse le scroll vertical au navigateur ;
      // dnd-kit ne prend la main qu'après le délai d'appui long.
      {...attributes}
      {...listeners}
    >
      <TaskItem task={task} isDragging={isDragging} {...props} />
    </div>
  );
}
