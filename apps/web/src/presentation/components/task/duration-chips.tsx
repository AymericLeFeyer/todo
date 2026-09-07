import { TASK_DURATIONS, formatDuration, type TaskDuration } from '@todo/core';
import { Clock, Infinity as InfinityIcon } from 'lucide-react';
import { Chip } from '@/presentation/components/ui/chip';

export interface DurationChipsProps {
  value: TaskDuration | null;
  onChange: (value: TaskDuration | null) => void;
}

/** Rangée « Durée estimée » : trois paliers, plus « indéterminée ». */
export function DurationChips({ value, onChange }: DurationChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TASK_DURATIONS.map((duration) => (
        <Chip
          key={duration}
          active={value === duration}
          onClick={() => onChange(value === duration ? null : duration)}
        >
          <Clock className="size-4" />
          {formatDuration(duration)}
        </Chip>
      ))}
      <Chip active={value === null} onClick={() => onChange(null)}>
        <InfinityIcon className="size-4" />
        Indéterminée
      </Chip>
    </div>
  );
}
