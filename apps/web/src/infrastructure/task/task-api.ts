import type {
  CreateTaskInput,
  DateOnly,
  ReorderInput,
  Task,
  TodayStats,
  UpdateTaskInput,
} from '@todo/core';
import { http, queryString } from '../http/client.js';

export interface TaskQuery {
  tags?: string[];
  tagsMode?: 'all' | 'any';
  status?: 'open' | 'done' | 'all';
  from?: DateOnly;
  to?: DateOnly;
  noDate?: boolean;
  search?: string;
  limit?: number;
}

export const taskApi = {
  list(query: TaskQuery = {}, signal?: AbortSignal): Promise<Task[]> {
    const path = `/api/tasks${queryString({
      tags: query.tags?.join(','),
      tagsMode: query.tagsMode,
      status: query.status,
      from: query.from,
      to: query.to,
      noDate: query.noDate,
      search: query.search,
      limit: query.limit,
    })}`;
    return http.get<{ tasks: Task[] }>(path, signal).then((payload) => payload.tasks);
  },

  get: (id: string) => http.get<Task>(`/api/tasks/${id}`),

  create: (input: CreateTaskInput) => http.post<Task>('/api/tasks', input),

  update: (id: string, input: UpdateTaskInput) => http.patch<Task>(`/api/tasks/${id}`, input),

  remove: (id: string) => http.delete<void>(`/api/tasks/${id}`),

  setCompleted: (id: string, completed: boolean) =>
    http.post<Task>(`/api/tasks/${id}/${completed ? 'complete' : 'uncomplete'}`),

  reorder: (input: ReorderInput) =>
    http.post<{ tasks: Task[] }>('/api/tasks/reorder', input).then((payload) => payload.tasks),

  todayStats: () => http.get<TodayStats>('/api/stats/today'),
};
