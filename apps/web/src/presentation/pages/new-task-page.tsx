import {
  fromDateOnly,
  quickParse,
  relativeDayLabel,
  slugifyTag,
  type DateOnly,
  type TaskDuration,
} from '@todo/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCreateTask } from '@/application/task/task-queries';
import { DueDateChips } from '@/presentation/components/task/due-date-chips';
import { DurationChips } from '@/presentation/components/task/duration-chips';
import { TagPicker } from '@/presentation/components/task/tag-picker';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';

/**
 * Écran d'ajout plein écran.
 *
 * Le parti pris : une seule zone de frappe, et tout ce qui peut être déduit du
 * texte l'est (« demain 30min #aylabs »). Les trois rangées de puces montrent
 * en direct ce qui a été compris et restent modifiables au pouce — un choix
 * manuel prend toujours le pas sur la détection.
 */
export function NewTaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const create = useCreateTask();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [raw, setRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // `undefined` = on suit la détection ; une valeur = l'utilisateur a tranché.
  const [manualDate, setManualDate] = useState<DateOnly | null | undefined>(
    parseInitialDate(searchParams.get('date')),
  );
  const [manualDuration, setManualDuration] = useState<TaskDuration | null | undefined>(undefined);
  const [manualTags, setManualTags] = useState<string[] | undefined>(
    parseInitialTags(searchParams.get('tag')),
  );

  const parsed = useMemo(() => quickParse(raw), [raw]);

  const dueDate = manualDate !== undefined ? manualDate : parsed.dueDate;
  const duration = manualDuration !== undefined ? manualDuration : parsed.duration;
  const tags = manualTags ?? parsed.tagNames.map(slugifyTag);
  const detected = manualDate === undefined && parsed.matches.length > 0;

  const title = parsed.title.trim();
  const canSubmit = title.length > 0 && !create.isPending;

  const submit = (event: FormEvent, keepOpen = false) => {
    event.preventDefault();
    if (!canSubmit) return;

    create.mutate(
      {
        title,
        dueDate,
        duration,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (task) => {
          // L'écran se referme sur la vue d'où l'on vient, où la tâche
          // n'apparaît pas forcément (une tâche sans date part dans l'Inbox).
          // Le message dit donc toujours où elle a atterri, et propose d'y aller.
          toast.success(`Ajoutée à ${describeDestination(task.dueDate)}`, {
            action: {
              label: 'Voir',
              onClick: () => navigate(task.dueDate === null ? '/inbox' : '/upcoming'),
            },
          });

          if (keepOpen) {
            // « Enregistrer et continuer » : on garde date, durée et tags pour
            // enchaîner une série de tâches sans tout re-choisir.
            setRaw('');
            setNotes('');
            setManualDate(dueDate);
            setManualDuration(duration);
            setManualTags(tags);
            inputRef.current?.focus();
          } else {
            navigate(-1);
          }
        },
        onError: () => toast.error("Impossible d'enregistrer la tâche"),
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex min-h-dvh flex-col bg-background"
      // La zone de saisie occupe tout l'écran : le clavier reste ouvert et
      // les puces se placent juste au-dessus de lui.
    >
      <header className="safe-top flex items-center justify-between px-2 py-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="size-5" />
          <span className="sr-only">Annuler</span>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Nouvelle tâche</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canSubmit}
          onClick={(event) => submit(event, true)}
        >
          Et continuer
        </Button>
      </header>

      <div className="flex-1 px-4 pt-2">
        <Textarea
          ref={inputRef}
          autoFocus
          rows={3}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) submit(event);
          }}
          placeholder="Que faut-il faire ?"
          className="min-h-24 resize-none border-0 px-0 text-xl leading-snug focus-visible:ring-0"
        />

        {showNotes ? (
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            className="mt-1 min-h-16 resize-none border-0 px-0 text-sm focus-visible:ring-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Ajouter une note
          </button>
        )}

        {detected && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            Reconnu dans le texte : {parsed.matches.map((match) => match.text).join(', ')}
          </p>
        )}
      </div>

      <div className="safe-bottom sticky bottom-0 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <DueDateChips value={dueDate} onChange={setManualDate} />
        <DurationChips value={duration} onChange={setManualDuration} />
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TagPicker value={tags} onChange={setManualTags} />
          </div>
          <Button type="submit" size="icon" disabled={!canSubmit} aria-label="Enregistrer">
            <ArrowUp className="size-5" strokeWidth={2.5} />
          </Button>
        </div>
      </div>
    </form>
  );
}

/** « aujourd'hui », « l'Inbox », « lundi 14 septembre » : où la tâche a atterri. */
function describeDestination(dueDate: DateOnly | null): string {
  if (dueDate === null) return "l'Inbox";
  const label = relativeDayLabel(dueDate);
  if (label) return label.toLowerCase();
  return format(fromDateOnly(dueDate), 'EEEE d MMMM', { locale: fr });
}

function parseInitialDate(value: string | null): DateOnly | null | undefined {
  return value ?? undefined;
}

function parseInitialTags(value: string | null): string[] | undefined {
  return value ? [slugifyTag(value)] : undefined;
}
