import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/shared/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Calendrier de la feuille « Pour quand », en français et en semaine du lundi. */
export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={fr}
      weekStartsOn={1}
      showOutsideDays
      className={cn('p-1', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'space-y-3',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-sm font-semibold capitalize',
        nav: 'flex items-center gap-1 absolute right-1 top-1',
        button_previous:
          'inline-flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-30',
        button_next:
          'inline-flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-10 text-xs font-normal text-muted-foreground capitalize',
        week: 'flex w-full mt-1',
        day: 'p-0',
        day_button:
          'size-10 rounded-lg text-sm hover:bg-accent aria-selected:bg-primary aria-selected:text-primary-foreground',
        // Le jour courant porte un anneau plutôt qu'une simple couleur : dans
        // une grille dense, une nuance de texte seule ne se repère pas, et
        // l'anneau reste lisible même quand ce jour est aussi sélectionné.
        today:
          'font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary [&>button]:text-primary [&>button[aria-selected=true]]:text-primary-foreground',
        outside: 'text-muted-foreground/40',
        disabled: 'opacity-30',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
