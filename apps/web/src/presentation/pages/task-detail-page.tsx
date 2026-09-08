import type { DateOnly, Task, TaskDuration, TaskRecurrence } from '@todo/core';
import { Check, RotateCcw, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useDeleteTask,
  useTask,
  useToggleTask,
  useUpdateTask,
} from '@/application/task/task-queries';
import { DueDateChips } from '@/presentation/components/task/due-date-chips';
import { DurationChips } from '@/presentation/components/task/duration-chips';
import { RecurrenceChips } from '@/presentation/components/task/recurrence-chips';
import { TagPicker } from '@/presentation/components/task/tag-picker';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';

/** Fiche d'une tâche : même vocabulaire de puces que l'écran d'ajout. */
export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task } = useTask(id);

  if (!task) return <div className="min-h-dvh bg-background" />;

  // La `key` remonte le formulaire quand on passe d'une tâche à l'autre :
  // les brouillons de titre et de notes repartent des bonnes valeurs sans
  // effet de synchronisation.
  return <TaskDetailForm key={task.id} task={task} />;
}

function TaskDetailForm({ task }: { task: Task }) {
  const navigate = useNavigate();
  const update = useUpdateTask();
  const toggle = useToggleTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');

  // Ce qui est déjà parti au serveur. Le bouton « Enregistrer » reçoit le
  // `blur` du champ juste avant son clic : sans cette trace, la même valeur
  // serait envoyée deux fois.
  const saved = useRef({ title: task.title, notes: task.notes ?? '' });

  const completed = task.completedAt !== null;

  const patch = (input: Parameters<typeof update.mutate>[0]['input']) =>
    update.mutate(
      { id: task.id, input },
      { onError: () => toast.error('Modification non enregistrée') },
    );

  const saveTitle = () => {
    const trimmed = title.trim();
    // Un titre vide n'a pas de sens : on remet celui qui est enregistré.
    if (trimmed.length === 0) {
      setTitle(saved.current.title);
      return;
    }
    if (trimmed === saved.current.title) return;
    saved.current.title = trimmed;
    patch({ title: trimmed });
  };

  const saveNotes = () => {
    const trimmed = notes.trim();
    if (trimmed === saved.current.notes) return;
    saved.current.notes = trimmed;
    patch({ notes: trimmed || null });
  };

  /**
   * Bouton principal : il ferme la fiche en enregistrant les champs libres.
   * Cocher la tâche est une action distincte, plus bas — « terminer » l'édition
   * et « terminer » la tâche ne doivent pas se confondre dans un même bouton.
   */
  const saveAndClose = () => {
    saveTitle();
    saveNotes();
    navigate(-1);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="safe-top flex items-center justify-between px-2 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="size-5" />
          <span className="sr-only">Fermer</span>
        </Button>
        <Button size="sm" onClick={saveAndClose}>
          <Check className="size-4" />
          Enregistrer
        </Button>
      </header>

      <div className="flex-1 space-y-4 px-4 pt-2">
        <Textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          rows={2}
          className="min-h-16 resize-none border-0 px-0 text-xl leading-snug focus-visible:ring-0"
        />

        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotes}
          placeholder="Notes"
          className="min-h-20 resize-none border-0 px-0 text-sm focus-visible:ring-0"
        />

        <div className="space-y-3 pt-2">
          <Field label="Pour quand">
            <DueDateChips
              value={task.dueDate}
              onChange={(value: DateOnly | null) =>
                // Sans échéance, une répétition n'a plus d'ancre : les deux
                // champs se vident ensemble.
                patch(value === null ? { dueDate: null, recurrence: null } : { dueDate: value })
              }
            />
          </Field>
          <Field label="Durée estimée">
            <DurationChips
              value={task.duration}
              onChange={(value: TaskDuration | null) => patch({ duration: value })}
            />
          </Field>
          {task.dueDate !== null && (
            <Field label="Répétition">
              <RecurrenceChips
                value={task.recurrence}
                onChange={(value: TaskRecurrence | null) => patch({ recurrence: value })}
              />
            </Field>
          )}
          <Field label="Tags">
            <TagPicker
              value={task.tags.map((tag) => tag.slug)}
              onChange={(slugs) => patch({ tags: slugs })}
            />
          </Field>
        </div>
      </div>

      <div className="safe-bottom space-y-1 px-4 py-4">
        <Button
          variant={completed ? 'secondary' : 'outline'}
          className="w-full"
          onClick={() => toggle.mutate({ id: task.id, completed: !completed })}
        >
          {completed ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
          {completed ? 'Rouvrir la tâche' : 'Marquer comme terminée'}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10"
          onClick={() => {
            remove.mutate(task.id);
            navigate(-1);
          }}
        >
          <Trash2 className="size-4" />
          Supprimer la tâche
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
