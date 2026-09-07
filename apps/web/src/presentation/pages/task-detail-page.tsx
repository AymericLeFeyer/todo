import type { DateOnly, Task, TaskDuration } from '@todo/core';
import { Check, Trash2, X } from 'lucide-react';
import { useState } from 'react';
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

  const completed = task.completedAt !== null;

  const patch = (input: Parameters<typeof update.mutate>[0]['input']) =>
    update.mutate(
      { id: task.id, input },
      { onError: () => toast.error('Modification non enregistrée') },
    );

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed.length > 0 && trimmed !== task.title) patch({ title: trimmed });
    else if (trimmed.length === 0) setTitle(task.title);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="safe-top flex items-center justify-between px-2 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="size-5" />
          <span className="sr-only">Fermer</span>
        </Button>
        <Button
          variant={completed ? 'secondary' : 'default'}
          size="sm"
          onClick={() => toggle.mutate({ id: task.id, completed: !completed })}
        >
          <Check className="size-4" />
          {completed ? 'Rouvrir' : 'Terminer'}
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
          onBlur={() => {
            if (notes !== (task.notes ?? '')) patch({ notes: notes.trim() || null });
          }}
          placeholder="Notes"
          className="min-h-20 resize-none border-0 px-0 text-sm focus-visible:ring-0"
        />

        <div className="space-y-3 pt-2">
          <Field label="Pour quand">
            <DueDateChips
              value={task.dueDate}
              onChange={(value: DateOnly | null) => patch({ dueDate: value })}
            />
          </Field>
          <Field label="Durée estimée">
            <DurationChips
              value={task.duration}
              onChange={(value: TaskDuration | null) => patch({ duration: value })}
            />
          </Field>
          <Field label="Tags">
            <TagPicker
              value={task.tags.map((tag) => tag.slug)}
              onChange={(slugs) => patch({ tags: slugs })}
            />
          </Field>
        </div>
      </div>

      <div className="safe-bottom px-4 py-4">
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
