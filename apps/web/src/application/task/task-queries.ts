import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateTaskInput, ReorderInput, Task, TodayStats, UpdateTaskInput } from '@todo/core';
import { taskApi, type TaskQuery } from '../../infrastructure/task/task-api.js';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => ['tasks', 'list'] as const,
  list: (query: TaskQuery) => ['tasks', 'list', query] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  stats: () => ['tasks', 'stats'] as const,
};

export function useTasks(query: TaskQuery, enabled = true) {
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: ({ signal }) => taskApi.list(query, signal),
    enabled,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => taskApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useTodayStats() {
  return useQuery<TodayStats>({
    queryKey: taskKeys.stats(),
    queryFn: () => taskApi.todayStats(),
    // La pastille doit rester juste même si l'app est restée ouverte
    // toute la journée ou si AyLabs a écrit entre-temps.
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Applique une transformation à toutes les listes de tâches en cache.
 * Le glisser-déposer et la case à cocher doivent réagir immédiatement : on ne
 * peut pas attendre l'aller-retour réseau avant de redessiner.
 */
function patchCachedLists(client: QueryClient, transform: (tasks: Task[]) => Task[]): void {
  client.setQueriesData<Task[]>({ queryKey: taskKeys.lists() }, (tasks) =>
    tasks ? transform(tasks) : tasks,
  );
}

function invalidateTasks(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: taskKeys.all });
}

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => taskApi.create(input),
    onSuccess: () => invalidateTasks(client),
  });
}

export function useUpdateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      taskApi.update(id, input),
    onSuccess: (task) => {
      client.setQueryData(taskKeys.detail(task.id), task);
      invalidateTasks(client);
    },
  });
}

export function useToggleTask() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      taskApi.setCompleted(id, completed),

    onMutate: async ({ id, completed }) => {
      await client.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = client.getQueriesData<Task[]>({ queryKey: taskKeys.lists() });

      patchCachedLists(client, (tasks) =>
        tasks.map((task) =>
          task.id === id
            ? { ...task, completedAt: completed ? new Date().toISOString() : null }
            : task,
        ),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },

    onSettled: () => invalidateTasks(client),
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskApi.remove(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = client.getQueriesData<Task[]>({ queryKey: taskKeys.lists() });
      patchCachedLists(client, (tasks) => tasks.filter((task) => task.id !== id));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },
    onSettled: () => invalidateTasks(client),
  });
}

export function useReorderTasks() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderInput) => taskApi.reorder(input),

    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = client.getQueriesData<Task[]>({ queryKey: taskKeys.lists() });

      const moves = new Map(input.moves.map((move) => [move.id, move]));
      patchCachedLists(client, (tasks) =>
        tasks.map((task) => {
          const move = moves.get(task.id);
          return move ? { ...task, dueDate: move.dueDate, position: move.position } : task;
        }),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },

    onSettled: () => invalidateTasks(client),
  });
}
