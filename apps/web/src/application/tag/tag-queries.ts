import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTagInput } from '@todo/core';
import { tagApi } from '../../infrastructure/tag/tag-api.js';

export const tagKeys = {
  all: ['tags'] as const,
  list: () => ['tags', 'list'] as const,
};

export function useTags() {
  return useQuery({ queryKey: tagKeys.list(), queryFn: () => tagApi.list() });
}

export function useCreateTag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    onSuccess: () => void client.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useDeleteTag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: tagKeys.all });
      void client.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
