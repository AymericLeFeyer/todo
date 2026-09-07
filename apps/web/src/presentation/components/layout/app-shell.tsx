import { CalendarDays, Hash, Inbox, ListTodo, Plus, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTodayStats } from '@/application/task/task-queries';
import { useHeaderHeight } from '@/presentation/hooks/use-header-height';
import { cn } from '@/shared/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof ListTodo;
  /** Affiche la pastille du nombre de tâches du jour. */
  withBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: "Aujourd'hui", icon: ListTodo, withBadge: true },
  { to: '/upcoming', label: 'Agenda', icon: CalendarDays },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/tags', label: 'Tags', icon: Hash },
  { to: '/settings', label: 'Réglages', icon: Settings },
];

export interface AppShellProps {
  title: string;
  /** Contenu additionnel affiché sous le titre (compteurs, filtres). */
  subtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Contexte transmis à l'écran d'ajout, par exemple `?date=2026-09-08`.
   * Une tâche ajoutée depuis « Aujourd'hui » doit atterrir aujourd'hui, sinon
   * elle part dans l'Inbox et semble ne pas avoir été créée.
   */
  newTaskQuery?: string;
  children: ReactNode;
}

/**
 * Coquille commune à toutes les vues : barre d'onglets en bas sur mobile
 * (atteignable au pouce), colonne latérale à partir de `md`. Le bouton
 * d'ajout reste flottant et toujours accessible, c'est l'action principale.
 */
export function AppShell({ title, subtitle, actions, newTaskQuery, children }: AppShellProps) {
  const navigate = useNavigate();
  const { data: stats } = useTodayStats();
  const headerRef = useHeaderHeight();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* `sticky` + hauteur du viewport : sans cela, la colonne défile avec la
          liste et le menu finit par sortir de l'écran. */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface p-3 md:sticky md:top-0 md:block md:h-dvh md:overflow-y-auto">
        <p className="px-3 pb-4 pt-2 text-lg font-semibold">Todo</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} badge={stats?.badge ?? 0} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          ref={headerRef}
          className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            {actions}
          </div>
        </header>

        {/* La marge basse dégage la barre d'onglets et le bouton flottant. */}
        <main className="flex-1 px-3 pb-40 pt-2 md:px-6 md:pb-16">{children}</main>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/new${newTaskQuery ?? ''}`)}
        aria-label="Ajouter une tâche"
        className={cn(
          'fixed right-5 z-40 flex size-14 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg shadow-primary/25',
          'transition-transform active:scale-95',
          'bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-8',
        )}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <TabLink key={item.to} item={item} badge={stats?.badge ?? 0} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function SidebarLink({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-accent font-medium text-foreground'
            : 'text-muted-foreground hover:bg-accent/60',
        )
      }
    >
      <Icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.withBadge && badge > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function TabLink({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <span className="relative">
        <Icon className="size-5" />
        {item.withBadge && badge > 0 && (
          <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {badge}
          </span>
        )}
      </span>
      {item.label}
    </NavLink>
  );
}
