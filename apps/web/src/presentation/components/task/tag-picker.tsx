import { slugifyTag } from '@todo/core';
import { Hash, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTags } from '@/application/tag/tag-queries';
import { Chip } from '@/presentation/components/ui/chip';
import { Input } from '@/presentation/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';

export interface TagPickerProps {
  /** Slugs sélectionnés. */
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Rangée de tags : les tags existants sont proposés directement, et un tag
 * inconnu se crée à la volée depuis la même zone de recherche. C'est aussi ce
 * que fait le parseur quand on tape `#aylabs` dans le titre.
 */
export function TagPicker({ value, onChange }: TagPickerProps) {
  const { data: tags } = useTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = new Set(value);
  const toggle = (slug: string) =>
    onChange(selected.has(slug) ? value.filter((item) => item !== slug) : [...value, slug]);

  const known = tags ?? [];
  const filtered = search
    ? known.filter((tag) => tag.slug.includes(slugifyTag(search)))
    : known.slice(0, 12);

  // Tags issus du texte (`#truc`) mais pas encore créés côté serveur.
  const pending = value.filter((slug) => !known.some((tag) => tag.slug === slug));
  const searchSlug = slugifyTag(search);
  const canCreate = searchSlug.length > 0 && !known.some((tag) => tag.slug === searchSlug);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Chip>
            <Hash className="size-4" />
            Tags
          </Chip>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <Input
            autoFocus
            placeholder="Rechercher ou créer…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mb-2 h-9"
          />
          <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
            {filtered.map((tag) => (
              <Chip
                key={tag.id}
                active={selected.has(tag.slug)}
                accent={tag.color}
                onClick={() => toggle(tag.slug)}
              >
                {tag.name}
                <span className="text-xs opacity-60">{tag.openTasks || ''}</span>
              </Chip>
            ))}
            {canCreate && (
              <Chip
                onClick={() => {
                  toggle(searchSlug);
                  setSearch('');
                  setOpen(false);
                }}
              >
                <Plus className="size-4" />
                Créer « {search.trim()} »
              </Chip>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-1 py-2 text-sm text-muted-foreground">Aucun tag</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.map((slug) => {
        const tag = known.find((item) => item.slug === slug);
        return (
          <Chip
            key={slug}
            active
            accent={tag?.color}
            onClick={() => toggle(slug)}
            title="Retirer ce tag"
          >
            {tag?.name ?? slug}
            {pending.includes(slug) && <span className="text-xs opacity-60">nouveau</span>}
          </Chip>
        );
      })}
    </div>
  );
}
