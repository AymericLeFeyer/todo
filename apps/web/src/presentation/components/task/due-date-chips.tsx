import {
  addDays,
  fromDateOnly,
  isWeekend,
  nextWeekend,
  toDateOnly,
  today,
  tomorrow,
  type DateOnly,
} from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, CalendarOff, Sofa, Sun, Sunrise } from 'lucide-react';
import { useState } from 'react';
import { Calendar } from '@/presentation/components/ui/calendar';
import { Chip } from '@/presentation/components/ui/chip';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';

export interface DueDateChipsProps {
  value: DateOnly | null;
  onChange: (value: DateOnly | null) => void;
}

/**
 * Rangée « Pour quand ». Les trois raccourcis couvrent l'immense majorité des
 * cas ; le calendrier n'est ouvert que pour le reste, ce qui garde la saisie
 * à un seul geste la plupart du temps.
 */
export function DueDateChips({ value, onChange }: DueDateChipsProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const todayDate = today();
  const tomorrowDate = tomorrow();
  const weekendDate = nextWeekend();

  // « Ce week-end » n'a pas de sens un samedi ou un dimanche : le raccourci
  // désignerait le jour même, déjà proposé par « Aujourd'hui ».
  const showWeekend = !isWeekend(todayDate) && weekendDate !== tomorrowDate;
  const isCustom =
    value !== null && value !== todayDate && value !== tomorrowDate && value !== weekendDate;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip
        active={value === todayDate}
        onClick={() => onChange(value === todayDate ? null : todayDate)}
      >
        <Sun className="size-4" />
        Aujourd'hui
      </Chip>

      <Chip
        active={value === tomorrowDate}
        onClick={() => onChange(value === tomorrowDate ? null : tomorrowDate)}
      >
        <Sunrise className="size-4" />
        Demain
      </Chip>

      {showWeekend && (
        <Chip
          active={value === weekendDate}
          onClick={() => onChange(value === weekendDate ? null : weekendDate)}
        >
          <Sofa className="size-4" />
          Ce week-end
        </Chip>
      )}

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Chip active={isCustom}>
            <CalendarDays className="size-4" />
            {isCustom ? format(fromDateOnly(value), 'd MMM', { locale: fr }) : 'Date…'}
          </Chip>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            defaultMonth={value ? fromDateOnly(value) : undefined}
            selected={value ? fromDateOnly(value) : undefined}
            disabled={{ before: fromDateOnly(addDays(todayDate, -365)) }}
            onSelect={(date) => {
              onChange(date ? toDateOnly(date) : null);
              setCalendarOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Chip active={value === null} onClick={() => onChange(null)}>
        <CalendarOff className="size-4" />
        Sans date
      </Chip>
    </div>
  );
}
