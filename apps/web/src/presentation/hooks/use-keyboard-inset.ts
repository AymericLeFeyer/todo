import { useEffect } from 'react';

/**
 * Publie la hauteur du clavier virtuel dans `--keyboard-inset`.
 *
 * iOS ne redimensionne pas la fenêtre à l'ouverture du clavier — `100dvh` et
 * `position: sticky` continuent de viser le bas de l'écran, donc les barres
 * d'outils se retrouvent cachées derrière les touches. `visualViewport` est le
 * seul moyen fiable de connaître la place réellement visible, et la variable
 * permet ensuite de remonter ce qui doit rester atteignable.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      // Quelques pixels d'écart existent en permanence (barres du navigateur) :
      // en deçà de ce seuil, il ne s'agit pas d'un clavier.
      root.style.setProperty('--keyboard-inset', `${hidden > 40 ? Math.round(hidden) : 0}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
