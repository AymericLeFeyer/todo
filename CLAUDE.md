# CLAUDE.md — Todo

Dernière mise à jour : 2026-09-08

Gestionnaire de tâches auto-hébergé (homelab, accès VPN). PWA mobile-first +
API REST filtrable par tags consommée par AyLabs.

## Stack

- Monorepo **npm workspaces** (pas de pnpm sur la machine), Node 24, TypeScript 6 strict
- `packages/core` — domaine pur partagé, Zod 4
- `apps/api` — Fastify 5, better-sqlite3 13, web-push, node-cron
- `apps/web` — React 19, Vite 8, Tailwind 4, **shadcn/ui** (choix figé), TanStack Query 5, dnd-kit
- Identité : couleur primaire bleue (`oklch(0.55 0.22 258)` en clair,
  `oklch(0.64 0.19 258)` en sombre) ; le rouge reste réservé au retard et aux
  actions destructives. Icônes générées par `apps/web/scripts/generate-icons.mjs`
  (fond plein, sans coin transparent : chaque plateforme applique son propre masque)
- Tests : Vitest 5 (`--project core`, `--project api`)
- CI : GitHub Actions (lint, format, typecheck, tests) puis publication de
  l'image sur `ghcr.io/aymericlefeyer/todo` en amd64 + arm64 à chaque push sur
  `main` ; une pull request construit l'image sans la publier

## Structure

```
packages/core/src/
├── domain/task/{entities,services}   Task, DateOnly, TaskDuration, TaskRecurrence, positions, quick-parse, agenda
├── domain/tag/entities               Tag, slugifyTag, palette
├── domain/shared                     uuidv7, DomainError/NotFoundError/ValidationError
└── contracts/                        schémas Zod partagés API ↔ clients

apps/api/src/
├── domain/                repositories.ts (interfaces), notifications.ts (port PushSender)
├── application/           use cases (task/, tag/, push/) + task/recurrence-scheduler.ts
├── infrastructure/        db/ (connexion + migrations), repositories/, push/, scheduler/
├── presentation/          routes/, plugins/ (auth, error-handler)
├── container.ts           composition root
└── app.ts / main.ts       buildApp(container) — app.ts est réutilisé par les tests

apps/web/src/
├── application/           hooks TanStack Query (task-queries, tag-queries, use-badge-sync)
├── infrastructure/        http/client.ts, task/, tag/, system/, pwa/ (sw, badge, push, register)
├── presentation/          components/{ui,task,layout}, pages/, hooks/
└── shared/lib/utils.ts    cn()
```

**Le domaine vit dans `packages/core`** et sert aux deux apps : le calcul de
position du glisser-déposer et le parseur de saisie rapide tournent à
l'identique côté client et côté serveur.

## Domaine `task`

`Task` : `id`, `title`, `notes`, `dueDate` (`YYYY-MM-DD` ou `null` = Inbox),
`duration` (15 | 30 | 60 | `null`), `position` (réel), `completedAt`,
`recurrence` (`daily` | `weekly` | `monthly` | `yearly` | `null`),
`recurrenceParentId`, `source` (`app` | `api`), `externalId`, `tags[]`,
`createdAt`, `updatedAt`.

Services clés :

| Fonction                                  | Rôle                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `positionBetween(before, after)`          | Rang fractionnaire d'une insertion                            |
| `positionForIndex(tasks, index, movedId)` | Position d'un dépôt ; exclut la tâche déplacée                |
| `nextPosition(tasks)`                     | Ajout en fin de journée (+1024)                               |
| `needsRebalance` / `rebalance`            | Réindexation quand l'écart passe sous `1e-6`                  |
| `quickParse(input, now)`                  | `{ title, dueDate, duration, recurrence, tagNames, matches }` |
| `buildAgenda(tasks, from, to, now)`       | `{ overdue, days[] }`, jours vides conservés                  |
| `todayList(tasks, now)`                   | Retards puis tâches du jour                                   |
| `nextOccurrence(date, rec, notBefore?)`   | Échéance suivante ; `notBefore` rattrape le retard            |
| `isCompletedOn(task, date)`               | Terminée ce jour-là (fuseau local du lecteur)                 |

### Répétition

`recurrence` transforme la complétion en cycle : terminer une occurrence en
**crée une nouvelle** (`recurrenceParentId` = l'occurrence terminée) plutôt que
de reporter la même ligne — la tâche cochée reste dans le bilan du jour et
l'agenda porte déjà la suivante. Rouvrir l'occurrence supprime celle qu'elle a
engendrée, si elle est toujours ouverte.

Règles :

- Une répétition **exige une échéance** : sans `dueDate`, rien n'est engendré.
  L'UI masque la rangée de puces tant qu'aucune date n'est posée, et retirer la
  date remet `recurrence` à `null`.
- `nextOccurrence` plafonne au jour courant (`notBefore`) : une quotidienne
  oubliée depuis une semaine repart demain, pas six jours en arrière.
- Les mois se rabattent sur le dernier jour (31 janvier → 28 février).
- `quickParse` reconnaît « chaque jour / semaine / mois / année », « tous les
  mois », « tous les mardis » (qui pose aussi l'échéance).

## Use cases API

| Use case                                                            | Signature                                      | Notes                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `CreateTask`                                                        | `execute(input, source)` → `{ task, created }` | `created: false` si `externalId` déjà connu                     |
| `UpdateTask`                                                        | `execute(id, input)` → `Task`                  | Un changement de `dueDate` repositionne en fin de journée cible |
| `SetTaskCompletion`                                                 | `execute(id, completed, now?)` → `Task`        | Délègue la répétition à `RecurrenceScheduler`                   |
| `DeleteTask`                                                        | `execute(id)`                                  | `NotFoundError` si absente                                      |
| `ListTasks`                                                         | `execute(query)` → `Task[]`                    |                                                                 |
| `MoveTasks`                                                         | `execute({ moves })` → `Task[]`                | Applique puis réindexe les journées trop serrées                |
| `GetTodayStats`                                                     | `execute(now)` → `{ overdue, today, badge }`   | `badge = overdue + today`                                       |
| `RecurrenceScheduler.onCompleted` / `onReopened`                    | `(task, now?)`                                 | Crée / retire l'occurrence suivante d'une tâche répétée         |
| `ListTags` / `CreateTag` / `UpdateTag` / `DeleteTag`                |                                                | `ListTags` ajoute `openTasks`                                   |
| `PushNotifier.sendDailyDigest` / `notifyExternalTask` / `broadcast` | → nombre d'envois                              | Purge les abonnements expirés (404/410)                         |

## Endpoints

| Méthode                | Route                                                                                                               | Notes                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET`                  | `/api/tasks?tags=&tagsMode=all\|any&status=open\|done\|all&from=&to=&noDate=&search=&completedFrom=&limit=&offset=` | `tags` en CSV ; `completedFrom` = ISO, filtre sur `completed_at` |
| `POST`                 | `/api/tasks`                                                                                                        | `201` créée, `200` si `externalId` déjà connu                    |
| `GET`/`PATCH`/`DELETE` | `/api/tasks/:id`                                                                                                    | `DELETE` → `204`                                                 |
| `POST`                 | `/api/tasks/:id/complete` · `/uncomplete`                                                                           |                                                                  |
| `POST`                 | `/api/tasks/reorder`                                                                                                | `{ moves: [{ id, dueDate, position }] }`                         |
| `GET`/`POST`           | `/api/tags`, `PATCH`/`DELETE` `/api/tags/:id`                                                                       |                                                                  |
| `GET`                  | `/api/stats/today`                                                                                                  | Source de la pastille                                            |
| `GET`/`POST`/`DELETE`  | `/api/push/vapid-public-key`, `/api/push/subscription`                                                              |                                                                  |
| `POST`                 | `/api/push/test`                                                                                                    | Diffuse une notification de test                                 |
| `GET`/`POST`           | `/api/auth/status`, `/api/auth/login`, `/api/auth/logout`                                                           |                                                                  |
| `GET`/`POST`/`DELETE`  | `/api/api-keys`, `/api/api-keys/:id`                                                                                | La clé en clair n'est renvoyée qu'à la création                  |
| `GET`                  | `/api/health`                                                                                                       | Public                                                           |

Routes publiques (sans authentification) : `/api/health`, `/api/auth/login`,
`/api/auth/status`.

## Routes web

| Route                   | Page                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| `/today`                | Retards + tâches du jour, puis « Terminées aujourd'hui » (reprise possible) |
| `/upcoming`             | Agenda vertical infini, glisser-déposer                                     |
| `/inbox`                | Tâches sans échéance                                                        |
| `/tags` · `/tags/:slug` | Liste des tags, tâches d'un tag                                             |
| `/new?date=&tag=`       | Ajout plein écran                                                           |
| `/task/:id`             | Fiche d'une tâche                                                           |
| `/settings`             | Notifications, pastille, clés API                                           |

## Hooks

| Hook                                                  | Fichier                                   | Rôle                                                    |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `useTasks(query, enabled)`                            | `application/task/task-queries.ts`        | Liste filtrée                                           |
| `useTask(id)` / `useTodayStats()`                     | idem                                      | Détail / compteur pastille                              |
| `useCreateTask` / `useUpdateTask`                     | idem                                      | Invalident `['tasks']`                                  |
| `useToggleTask` / `useDeleteTask` / `useReorderTasks` | idem                                      | **Mutations optimistes** avec restauration sur erreur   |
| `useTags` / `useCreateTag` / `useDeleteTag`           | `application/tag/tag-queries.ts`          |                                                         |
| `useBadgeSync` / `BadgeSync`                          | `application/push/use-badge-sync.ts`      | Pose `setAppBadge` à chaque changement                  |
| `useInfiniteDays()`                                   | `presentation/hooks/use-infinite-days.ts` | Fenêtre de jours étendue par IntersectionObserver       |
| `useHeaderHeight()`                                   | `presentation/hooks/use-header-height.ts` | Publie `--app-header-height` pour les en-têtes collants |
| `useOpenNewTask()` / `useAutoFocus(ref)`              | `presentation/hooks/use-new-task.ts`      | Ouvre `/new` clavier levé, puis rend le focus au champ  |

## Patterns et conventions

- **Aucun `fetch` dans un composant** : tout passe par `infrastructure/http/client.ts`
  et un client par domaine (`taskApi`, `tagApi`, `systemApi`).
- **Positions fractionnaires** : déplacer une tâche ne réécrit qu'une ligne.
  Le client calcule la position avec le code du domaine, le serveur entérine et
  réindexe si nécessaire.
- **Migrations embarquées en TypeScript** (`infrastructure/db/migrations.ts`) :
  un seul artefact dans l'image, aucun chemin relatif à résoudre à l'exécution.
  Une migration publiée ne se modifie jamais, on en ajoute une.
- **Zod aux frontières** : les schémas de `packages/core/src/contracts` valident
  les entrées de l'API et typent les appels du client.
- **Erreurs** : lever `NotFoundError` / `ValidationError` ; le gestionnaire
  d'erreurs les traduit en `{ error, message }` avec le bon code HTTP.
- **Dates** : jamais de `Date` en base ni dans les échanges — uniquement
  `YYYY-MM-DD` local, via les helpers de `due-date.ts`.

## Points d'attention

- **HTTPS obligatoire pour l'iPhone.** `setAppBadge()`, l'installation PWA et
  le Web Push exigent un certificat valide : en `http://192.168.x.x`, rien de
  tout cela ne fonctionne. Voir la section HTTPS du README.
- **Pas de push silencieux sur iOS.** Le service worker _doit_ appeler
  `showNotification()` à chaque push, sinon Safari révoque l'abonnement. La
  pastille ne peut donc pas se rafraîchir discrètement app fermée : elle suit le
  résumé quotidien (`DAILY_DIGEST_CRON`) et les écritures de l'API.
- **`APP_PASSWORD` vide = API ouverte** à qui peut l'atteindre sur le réseau.
  Voulu pour un homelab derrière VPN, dangereux dès que le service est exposé.
  Un avertissement est journalisé au démarrage.
- **Zones sûres iOS** : tout ce qui se colle à un bord doit composer avec
  `env(safe-area-inset-*)` — l'en-tête (`safe-top`), la barre d'onglets, et les
  notifications, dont le décalage passe par les props `offset` / `mobileOffset`
  de sonner. Sans cela, les messages disparaissent sous l'heure de l'iPhone.
- **Clavier virtuel** : iOS ne redimensionne pas la fenêtre à son ouverture, si
  bien que `100dvh` et `sticky bottom-0` visent toujours le bas de l'écran
  physique. `useKeyboardInset` lit `visualViewport` et publie
  `--keyboard-inset` ; l'écran d'ajout s'en sert pour remonter ses puces.
- **Clavier iOS à l'ouverture de `/new`** : Safari n'ouvre le clavier que pour
  un `focus()` déclenché dans le geste de l'utilisateur, et `autoFocus` au
  montage arrive trop tard (curseur posé, pas de clavier). `useOpenNewTask`
  focalise donc un champ leurre pendant le tap, `useAutoFocus` lui reprend la
  main au montage — dans cet ordre, sinon le `blur` intermédiaire referme le
  clavier. Toute entrée vers `/new` doit être un bouton passant par ce hook,
  jamais un `<Link>`.
- **« Enregistrer » ≠ « Terminer »** sur la fiche d'une tâche : le bouton
  principal ferme la fiche en enregistrant titre et notes, la complétion est
  une action distincte en bas d'écran. Les confondre donnait l'impression que
  modifier une tâche la faisait disparaître.
- **Glisser-déposer mobile** : l'activation par appui long
  (`delay: 200, tolerance: 6`) est ce qui empêche le défilement au pouce
  d'arracher une tâche. Ne pas la retirer.
- **Pas de virtualisation dans l'agenda**, volontairement : elle casserait le
  dépôt inter-sections pour un gain nul à cette volumétrie.
- **Le heredoc bash convertit `\uXXXX`.** Pour écrire une séquence unicode
  échappée dans un fichier (regex de normalisation des accents), passer par
  `Write` ou construire la chaîne autrement.
- **`DELETE` sans corps** : Fastify rejette en `400` toute requête portant
  `Content-Type: application/json` avec un corps vide
  (`FST_ERR_CTP_EMPTY_JSON_BODY`). Une intégration qui envoie le header par
  défaut sur `DELETE /api/tasks/:id` tombera dessus ; le client web ne pose
  l'en-tête que lorsqu'il y a effectivement un corps.
- **better-sqlite3** est natif et sans binaire précompilé pour l'ABI de
  l'image : node-gyp compile, donc `python3 make g++` sont installés dans les
  étapes d'installation du Dockerfile (jamais dans l'image finale).
- **Build multi-architecture** : les étapes de compilation TypeScript tournent
  sur `$BUILDPLATFORM` (JavaScript portable, pleine vitesse) et seule
  l'installation des dépendances de production est émulée pour l'arm64. Fusionner
  ces étapes ferait passer un build ARM de quelques minutes à une demi-heure.
- **Deux fichiers compose** : `docker-compose.yml` construit localement,
  `docker-compose.portainer.yml` tire l'image GHCR (Portainer n'a pas le dépôt
  et ne peut rien construire).
- **`@todo/core` doit être compilé** (`npm run build -w @todo/core`) avant le
  typecheck de l'API ; la PWA, elle, pointe sur les sources via un alias Vite.
