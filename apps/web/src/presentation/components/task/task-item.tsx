import { formatDuration, fromDateOnly, isOverdue, today, type Task } from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onOpen?: (task: Task) => void;
  /** Affiche l'échéance sous le titre (utile hors vue par jour). */
  showDate?: boolean;
  isDragging?: boolean;
  className?: string;
}

export function TaskItem({
  task,
  onToggle,
  onOpen,
  showDate = false,
  isDragging = false,
  className,
}: TaskItemProps) {
  const completed = task.completedAt !== null;
  const late = isOverdue(task, today());

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl bg-card px-3 py-3 transition-colors',
        'border border-transparent hover:border-border',
        isDragging && 'opacity-60 shadow-lg ring-2 ring-primary/40',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={completed ? 'Rouvrir la tâche' : 'Terminer la tâche'}
        aria-pressed={completed}
        // Cible tactile de 44 px obtenue par la zone de clic, sans grossir le cercle.
        className="-m-2 flex size-11 shrink-0 items-center justify-center p-2"
      >
        <span
          className={cn(
            'flex size-5 items-center justify-center rounded-full border-2 transition-all',
            completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/50 group-hover:border-primary',
          )}
        >
          <Check
            className={cn('size-3 transition-opacity', completed ? 'opacity-100' : 'opacity-0')}
            strokeWidth={3}
          />
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen?.(task)}
        className="min-w-0 flex-1 text-left"
        disabled={!onOpen}
      >
        <p
          className={cn(
            'text-[15px] leading-snug break-words',
            completed && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>

        {(task.duration !== null || task.tags.length > 0 || (showDate && task.dueDate)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {showDate && task.dueDate && (
              <span className={cn(late && 'font-medium text-destructive')}>
                {format(fromDateOnly(task.dueDate), 'EEE d MMM', { locale: fr })}
              </span>
            )}
            {task.duration !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatDuration(task.duration)}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
