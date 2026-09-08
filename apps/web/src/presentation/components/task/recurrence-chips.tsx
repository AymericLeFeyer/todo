import { TASK_RECURRENCES, recurrenceLabel, type TaskRecurrence } from '@todo/core';
import { Ban, Repeat } from 'lucide-react';
import { Chip } from '@/presentation/components/ui/chip';

export interface RecurrenceChipsProps {
  value: TaskRecurrence | null;
  onChange: (value: TaskRecurrence | null) => void;
}

/**
 * Rangée « Répétition ». Terminer une tâche répétée engendre l'occurrence
 * suivante : la case cochée reste dans le bilan du jour, la prochaine est
 * déjà posée dans l'agenda.
 */
export function RecurrenceChips({ value, onChange }: RecurrenceChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={value === null} onClick={() => onChange(null)}>
        <Ban className="size-4" />
        Une fois
      </Chip>
      {TASK_RECURRENCES.map((recurrence) => (
        <Chip
          key={recurrence}
          active={value === recurrence}
          onClick={() => onChange(value === recurrence ? null : recurrence)}
        >
          <Repeat className="size-4" />
          {recurrenceLabel(recurrence)}
        </Chip>
      ))}
    </div>
  );
}
