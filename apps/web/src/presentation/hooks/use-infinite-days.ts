import { addDays, today, type DateOnly } from '@todo/core';
import { useCallback, useEffect, useRef, useState } from 'react';

const INITIAL_DAYS = 14;
const PAGE_DAYS = 14;
const MAX_DAYS = 365;

/**
 * Fenêtre de jours de l'agenda, étendue quand la sentinelle de bas de liste
 * devient visible. On ne virtualise pas : la liste reste un vrai DOM, ce qui
 * garde le glisser-déposer entre sections simple et fiable, et la volumétrie
 * d'un usage personnel ne justifie pas la complexité inverse.
 */
export function useInfiniteDays(): {
  from: DateOnly;
  to: DateOnly;
  sentinelRef: (node: HTMLElement | null) => void;
} {
  const from = today();
  const [dayCount, setDayCount] = useState(INITIAL_DAYS);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDayCount((count) => Math.min(count + PAGE_DAYS, MAX_DAYS));
        }
      },
      // On charge avant d'atteindre le bas : le scroll ne doit jamais buter.
      { rootMargin: '600px 0px' },
    );
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { from, to: addDays(from, dayCount - 1), sentinelRef };
}
