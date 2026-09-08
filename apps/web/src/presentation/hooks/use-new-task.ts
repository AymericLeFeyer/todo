import { useCallback, useLayoutEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Ouvre l'écran d'ajout avec le clavier déjà levé.
 *
 * iOS n'ouvre le clavier que pour un `focus()` déclenché dans le geste de
 * l'utilisateur : au moment du tap sur « + », le champ de l'écran d'ajout
 * n'existe pas encore, et un `autoFocus` au montage arrive trop tard (il place
 * le curseur, sans clavier). On focalise donc un champ leurre pendant le tap,
 * puis on lui passe la main dès que le vrai champ est monté — Safari
 * considère qu'il s'agit du même geste et garde le clavier ouvert.
 */

let primer: HTMLInputElement | null = null;
let primerTimeout: ReturnType<typeof setTimeout> | null = null;

function removePrimer(): void {
  if (primerTimeout !== null) {
    clearTimeout(primerTimeout);
    primerTimeout = null;
  }
  primer?.remove();
  primer = null;
}

function primeKeyboard(): void {
  removePrimer();

  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  // Le champ doit rester dans le viewport et rendu : Safari ignore le focus
  // sur un élément `display:none` ou hors écran. Un carré d'un pixel
  // transparent fait l'affaire, et 16px de police évite le zoom automatique.
  input.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:0',
    'width:1px',
    'height:1px',
    'padding:0',
    'border:0',
    'opacity:0',
    'font-size:16px',
    'background:transparent',
    'caret-color:transparent',
    'z-index:-1',
  ].join(';');

  document.body.appendChild(input);
  input.focus({ preventScroll: true });
  primer = input;

  // Filet de sécurité : si l'écran d'ajout ne se monte pas (navigation
  // annulée), le leurre ne doit pas rester à traîner dans le DOM.
  primerTimeout = setTimeout(removePrimer, 2000);
}

/** Navigue vers `/new` en levant le clavier au passage. */
export function useOpenNewTask(): (query?: string) => void {
  const navigate = useNavigate();

  return useCallback(
    (query = '') => {
      primeKeyboard();
      navigate(`/new${query}`);
    },
    [navigate],
  );
}

/**
 * Donne le focus au champ de saisie dès son montage, en reprenant le clavier
 * ouvert par `useOpenNewTask` si l'écran vient d'un tap sur « + ».
 */
export function useAutoFocus(ref: RefObject<HTMLTextAreaElement | null>): void {
  useLayoutEffect(() => {
    // L'ordre compte : focaliser la cible avant de retirer le leurre, sinon
    // le `blur` intermédiaire referme le clavier.
    ref.current?.focus({ preventScroll: true });
    removePrimer();
  }, [ref]);
}
