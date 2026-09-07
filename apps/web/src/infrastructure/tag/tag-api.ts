import type { CreateTagInput, Tag, UpdateTagInput } from '@todo/core';
import { http } from '../http/client.js';

export interface TagWithCount extends Tag {
  openTasks: number;
}

export const tagApi = {
  list: () => http.get<{ tags: TagWithCount[] }>('/api/tags').then((payload) => payload.tags),
  create: (input: CreateTagInput) => http.post<Tag>('/api/tags', input),
  update: (id: string, input: UpdateTagInput) => http.patch<Tag>(`/api/tags/${id}`, input),
  remove: (id: string) => http.delete<void>(`/api/tags/${id}`),
};
