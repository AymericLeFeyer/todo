import { useCallback, useEffect, useRef } from 'react';

/**
 * Publie la hauteur réelle de l'en-tête dans `--app-header-height`.
 *
 * Les en-têtes de jour de l'agenda se collent juste en dessous : une valeur
 * codée en dur se décalerait dès qu'un sous-titre s'ajoute ou que l'encoche
 * de l'iPhone entre en jeu.
 */
export function useHeaderHeight(): (node: HTMLElement | null) => void {
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;

    const publish = () =>
      document.documentElement.style.setProperty(
        '--app-header-height',
        `${node.getBoundingClientRect().height}px`,
      );

    publish();
    observerRef.current = new ResizeObserver(publish);
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return ref;
}
