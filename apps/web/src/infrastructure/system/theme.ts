const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Garde `.dark` sur `<html>` aligné sur le thème système pendant que l'app
 * reste ouverte. L'état initial est déjà posé par le script inline
 * d'`index.html` (avant le premier rendu) ; cet écouteur ne couvre que le
 * changement à chaud, par exemple une PWA laissée ouverte au coucher du
 * soleil quand le système bascule en sombre.
 */
export function watchSystemTheme(): void {
  const media = window.matchMedia(DARK_QUERY);
  const apply = (isDark: boolean) => document.documentElement.classList.toggle('dark', isDark);

  apply(media.matches);
  media.addEventListener('change', (event) => apply(event.matches));
}
