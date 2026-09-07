export interface TodayStats {
  /** Tâches non terminées dont l'échéance est dépassée. */
  overdue: number;
  /** Tâches dues aujourd'hui, hors retard. */
  today: number;
  /** Somme des deux : c'est la valeur affichée en pastille sur l'icône. */
  badge: number;
}
