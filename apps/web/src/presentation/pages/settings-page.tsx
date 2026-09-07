import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Check, Copy, KeyRound, Share, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTodayStats } from '@/application/task/task-queries';
import { isBadgeSupported, isStandalone } from '@/infrastructure/pwa/badge';
import {
  getSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/infrastructure/pwa/push';
import { systemApi } from '@/infrastructure/system/system-api';
import { AppShell } from '@/presentation/components/layout/app-shell';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';

export function SettingsPage() {
  return (
    <AppShell title="Réglages">
      <div className="space-y-8 pb-8">
        <NotificationsSection />
        <ApiKeysSection />
      </div>
    </AppShell>
  );
}

/**
 * Tout ce qui conditionne la pastille de l'icône est regroupé ici, avec les
 * contraintes iOS expliquées : sans PWA installée ni autorisation accordée,
 * `setAppBadge()` reste sans effet, et c'est la première source de confusion.
 */
function NotificationsSection() {
  const client = useQueryClient();
  const { data: stats } = useTodayStats();

  const { data: server } = useQuery({
    queryKey: ['push', 'vapid'],
    queryFn: () => systemApi.vapidPublicKey(),
  });

  const { data: subscription } = useQuery({
    queryKey: ['push', 'subscription'],
    queryFn: () => getSubscription(),
  });

  const enable = useMutation({
    mutationFn: () => subscribeToPush(),
    onSuccess: (status) => {
      void client.invalidateQueries({ queryKey: ['push'] });
      if (status === 'granted') toast.success('Notifications activées');
      else if (status === 'denied')
        toast.error('Autorisation refusée dans les réglages du système');
      else if (status === 'server-disabled') toast.error('Clés VAPID absentes côté serveur');
      else if (status === 'unsupported') toast.error('Ce navigateur ne gère pas les notifications');
    },
    onError: () => toast.error('Activation impossible'),
  });

  const disable = useMutation({
    mutationFn: () => unsubscribeFromPush(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['push'] });
      toast.success('Notifications désactivées');
    },
  });

  const test = useMutation({
    mutationFn: () => systemApi.sendTestPush(),
    onSuccess: (result) =>
      result.sent > 0
        ? toast.success(`Envoyé à ${result.sent} appareil${result.sent > 1 ? 's' : ''}`)
        : toast.error('Aucun appareil abonné'),
  });

  const standalone = isStandalone();
  const supported = isPushSupported();

  return (
    <section className="space-y-3">
      <SectionTitle icon={<Bell className="size-4" />}>Notifications et pastille</SectionTitle>

      <Row
        label="Pastille de l'icône"
        value={
          !isBadgeSupported()
            ? 'Non gérée par ce navigateur'
            : !standalone
              ? "Nécessite l'ajout à l'écran d'accueil"
              : `${stats?.badge ?? 0} tâche${(stats?.badge ?? 0) > 1 ? 's' : ''} affichée${(stats?.badge ?? 0) > 1 ? 's' : ''}`
        }
      />

      {!standalone && (
        <p className="flex gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          <Share className="mt-0.5 size-4 shrink-0" />
          <span>
            Sur iPhone : bouton <strong>Partager</strong> puis{' '}
            <strong>Sur l'écran d'accueil</strong>. La pastille et les notifications ne fonctionnent
            que depuis l'app ainsi installée, et uniquement en HTTPS.
          </span>
        </p>
      )}

      <Row
        label="Notifications push"
        value={
          !supported
            ? 'Non gérées'
            : server?.enabled === false
              ? 'Désactivées côté serveur'
              : subscription
                ? 'Cet appareil est abonné'
                : "Cet appareil n'est pas abonné"
        }
      />

      <div className="flex flex-wrap gap-2">
        {subscription ? (
          <Button variant="outline" onClick={() => disable.mutate()} disabled={disable.isPending}>
            <BellOff className="size-4" />
            Désactiver
          </Button>
        ) : (
          <Button
            onClick={() => enable.mutate()}
            disabled={!supported || enable.isPending || server?.enabled === false}
          >
            <Bell className="size-4" />
            Activer sur cet appareil
          </Button>
        )}

        <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
          Envoyer un test
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        iOS n'autorise pas les notifications invisibles : la pastille se met à jour app fermée au
        moment du résumé quotidien envoyé par le serveur, et instantanément dès que l'app est
        ouverte.
      </p>
    </section>
  );
}

/** Clés utilisées par les intégrations (AyLabs) pour lire et écrire des tâches. */
function ApiKeysSection() {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => systemApi.listApiKeys(),
  });

  const create = useMutation({
    mutationFn: (value: string) => systemApi.createApiKey(value),
    onSuccess: (record) => {
      setFreshKey(record.key);
      setName('');
      void client.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => systemApi.deleteApiKey(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <section className="space-y-3">
      <SectionTitle icon={<KeyRound className="size-4" />}>Clés API</SectionTitle>

      <p className="text-sm text-muted-foreground">
        À envoyer dans l'en-tête <code className="rounded bg-secondary px-1">X-API-Key</code> pour
        lire ou écrire des tâches depuis une autre application.
      </p>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate(name.trim());
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom de l'intégration"
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Créer
        </Button>
      </form>

      {freshKey && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
          <p className="text-sm font-medium">Copiez cette clé, elle ne sera plus affichée.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
              {freshKey}
            </code>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(freshKey);
                toast.success('Clé copiée');
              }}
            >
              <Copy className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setFreshKey(null)}>
              <Check className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {keys?.map((key) => (
          <li key={key.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{key.name}</p>
              <p className="text-xs text-muted-foreground">
                {key.lastUsedAt
                  ? `Dernier appel le ${new Date(key.lastUsedAt).toLocaleDateString('fr-FR')}`
                  : 'Jamais utilisée'}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove.mutate(key.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {keys?.length === 0 && <li className="text-sm text-muted-foreground">Aucune clé</li>}
      </ul>
    </section>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2.5 text-sm">
      <span>{label}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}
