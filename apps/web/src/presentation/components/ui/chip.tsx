import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';

export interface ChipProps extends ComponentProps<'button'> {
  active?: boolean;
  /** Couleur d'accent appliquée quand la puce est active (tags colorés). */
  accent?: string;
}

/**
 * Puce de sélection rapide. C'est la brique de l'écran d'ajout : trois
 * rangées de puces remplacent trois sélecteurs, et se manipulent d'un pouce.
 */
export function Chip({ className, active = false, accent, style, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm',
        'transition-colors active:scale-[0.97]',
        active
          ? 'border-primary bg-primary/15 font-medium text-primary'
          : 'border-border bg-transparent text-muted-foreground hover:bg-accent',
        className,
      )}
      style={
        active && accent
          ? { borderColor: accent, color: accent, backgroundColor: `${accent}22`, ...style }
          : style
      }
      {...props}
    />
  );
}
