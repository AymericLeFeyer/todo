import { NotFoundError, type CreateTagInput, type Tag, type UpdateTagInput } from '@todo/core';
import type { TagRepository } from '../../../domain/repositories.js';

export interface TagWithCount extends Tag {
  /** Nombre de tâches non terminées portant ce tag. */
  openTasks: number;
}

export class ListTags {
  constructor(private readonly tags: TagRepository) {}

  execute(): TagWithCount[] {
    const counts = this.tags.countsBySlug();
    return this.tags.findAll().map((tag) => ({ ...tag, openTasks: counts[tag.slug] ?? 0 }));
  }
}

export class CreateTag {
  constructor(private readonly tags: TagRepository) {}

  execute(input: CreateTagInput): Tag {
    return this.tags.create(input.name, input.color);
  }
}

export class UpdateTag {
  constructor(private readonly tags: TagRepository) {}

  execute(id: string, input: UpdateTagInput): Tag {
    const updated = this.tags.update(id, input);
    if (!updated) throw new NotFoundError('Tag', id);
    return updated;
  }
}

export class DeleteTag {
  constructor(private readonly tags: TagRepository) {}

  execute(id: string): void {
    if (!this.tags.delete(id)) throw new NotFoundError('Tag', id);
  }
}
