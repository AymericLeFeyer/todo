# Todo

Gestionnaire de tâches personnel, auto-hébergé, pensé pour le mobile. Deux
usages : les tâches du quotidien, et le pilotage de la chaîne **AyLabs** via une
API REST que d'autres applications consomment.

- **PWA mobile-first** installable sur l'écran d'accueil, avec pastille de
  compteur sur l'icône (iOS 16.4+).
- **Ajout en plein écran** : une seule zone de frappe,
  `Monter la vidéo demain 30min #aylabs` remplit échéance, durée et tags.
- **Agenda vertical infini** avec glisser-déposer d'un jour à l'autre.
- **API REST** filtrable par tags, authentifiée par clé.
- **100 % local** : SQLite, aucun service externe.

## Démarrage rapide

```bash
npm install
npm run build -w @todo/core     # les deux apps consomment le domaine compilé
cp .env.example .env            # puis renseigner SESSION_SECRET
npm run dev                     # API sur :3000, PWA sur :5173
```

En développement, `AUTH_DISABLED=true` évite d'avoir à se connecter.

| Commande                             | Effet                              |
| ------------------------------------ | ---------------------------------- |
| `npm run dev`                        | Domaine en watch + API + Vite      |
| `npm test`                           | Tests du domaine et de l'API       |
| `npm run typecheck` / `npm run lint` | Vérifications                      |
| `npm run build`                      | Compile les trois paquets          |
| `npm run vapid -w @todo/api`         | Génère les clés VAPID              |
| `npm run backup -w @todo/api`        | Sauvegarde à chaud (`VACUUM INTO`) |

## Déploiement sur le homelab

Chaque push sur `main` publie l'image sur GHCR, en `linux/amd64` et
`linux/arm64` :

```
ghcr.io/aymericlefeyer/todo:latest
ghcr.io/aymericlefeyer/todo:sha-<court>   # version figée d'un commit
```

### Portainer

1. **Rendre le package accessible.** Sur GitHub, `Packages → todo → Package
settings`, passer la visibilité en _public_ — ou, pour le garder privé,
   déclarer `ghcr.io` dans _Portainer → Registries_ avec un jeton
   d'accès personnel ayant la portée `read:packages`.
2. **Stacks → Add stack → Web editor**, coller le contenu de
   [`docker-compose.portainer.yml`](docker-compose.portainer.yml).
3. Renseigner les variables dans **Environment variables** :

   | Variable                                 | Valeur                                     |
   | ---------------------------------------- | ------------------------------------------ |
   | `SESSION_SECRET`                         | **obligatoire**, `openssl rand -base64 32` |
   | `APP_PASSWORD`                           | mot de passe de l'interface web            |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npm run vapid -w @todo/api`               |
   | `TODO_PORT`                              | port publié, `3000` par défaut             |
   | `TZ`                                     | `Europe/Paris`                             |

4. **Deploy the stack.** Cocher _Automatic updates_ (ou brancher un webhook)
   pour récupérer les images suivantes.

### En ligne de commande

```bash
cp .env.example .env
# SESSION_SECRET : openssl rand -base64 32
# APP_PASSWORD   : mot de passe de l'interface web
# VAPID_*        : npm run vapid -w @todo/api
docker compose up -d --build          # construction locale
docker compose -f docker-compose.portainer.yml up -d   # depuis l'image GHCR
```

La base vit dans le volume `todo-data` (`/data/todo.db`). L'API sert aussi la
PWA : une seule origine, donc pas de CORS à gérer côté navigateur.

### HTTPS : indispensable pour l'iPhone

`setAppBadge()`, l'installation sur l'écran d'accueil et le Web Push exigent un
**certificat valide**. Un accès VPN en `http://192.168.x.x:3000` ne suffit pas :
l'app restera utilisable dans Safari, mais sans installation ni pastille.

Trois voies, par ordre de simplicité :

1. **Tailscale Serve** — si le VPN est déjà Tailscale, c'est le plus court
   chemin : certificat `*.ts.net` automatique, rien à configurer.

   ```bash
   tailscale serve --bg --https=443 http://localhost:3000
   ```

2. **Caddy + Let's Encrypt en DNS-01** — profil `tls` du compose. Le défi DNS
   n'ouvre aucun port entrant ; il faut un domaine et un jeton DNS
   (l'exemple fourni utilise Cloudflare, voir `docker/caddy.Dockerfile` pour
   un autre registrar).

   ```bash
   # .env : TODO_DOMAIN, ACME_EMAIL, CLOUDFLARE_API_TOKEN
   docker compose --profile tls up -d --build
   ```

3. **HTTP simple** — acceptable pour un usage desktop, mais on renonce à la
   pastille et aux notifications sur iOS.

### Installation sur iPhone

1. Ouvrir l'URL HTTPS dans **Safari** (les autres navigateurs iOS ne peuvent
   pas installer de PWA).
2. **Partager** → **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône, puis **Réglages → Activer sur cet appareil**
   pour autoriser les notifications.
4. **Envoyer un test** vérifie de bout en bout notification et pastille.

L'écran Réglages affiche l'état réel de chaque prérequis, ce qui évite de
chercher pourquoi la pastille reste absente.

### Ce que la pastille sait faire, et ce qu'elle ne peut pas

iOS **n'autorise pas les notifications invisibles** : chaque push doit afficher
une notification, sinon Safari finit par révoquer l'abonnement. Il n'existe pas
non plus de Background Sync. Conséquences :

- app ouverte, ou ramenée au premier plan : la pastille est **toujours juste**,
  elle suit chaque création, chaque tâche cochée ;
- app fermée : la pastille se rafraîchit au **résumé quotidien**
  (`DAILY_DIGEST_CRON`, 7 h par défaut) et lorsqu'une intégration crée une
  tâche datée d'aujourd'hui.

Une app native comme Todoist met à jour son badge silencieusement ; une PWA ne
le peut pas. C'est la seule différence fonctionnelle.

## API

Authentification par en-tête `X-API-Key` (clés créées dans **Réglages → Clés
API**). L'interface web utilise, elle, un cookie de session.

```bash
KEY=todo_xxx
BASE=https://todo.mondomaine.fr

# Créer une tâche pour AyLabs
curl -X POST $BASE/api/tasks -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"title":"Monter la vidéo","dueDate":"2026-09-08","duration":60,
       "tags":["aylabs"],"externalId":"aylabs-video-42"}'

# Lire les tâches en cours d'un tag
curl "$BASE/api/tasks?tags=aylabs&status=open" -H "X-API-Key: $KEY"

# Compteur affiché sur la pastille
curl "$BASE/api/stats/today" -H "X-API-Key: $KEY"
```

`recurrence` vaut `daily`, `weekly`, `monthly`, `yearly` ou `null`, et exige une
`dueDate` : terminer une occurrence en crée une nouvelle à l'échéance suivante
(la rouvrir supprime celle qui venait d'être engendrée).

`externalId` rend la création **idempotente** : rejouer le même appel renvoie la
tâche existante avec un `200` au lieu d'un `201`, sans créer de doublon.

| Méthode                | Route                                          | Rôle                                                                                                                          |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`                  | `/api/tasks`                                   | Liste filtrable : `tags`, `tagsMode=all\|any`, `status`, `from`, `to`, `noDate`, `search`, `completedFrom`, `limit`, `offset` |
| `POST`                 | `/api/tasks`                                   | Création (`title`, `dueDate`, `duration`, `recurrence`, `tags`, `notes`, `externalId`)                                        |
| `GET`/`PATCH`/`DELETE` | `/api/tasks/:id`                               | Détail, mise à jour partielle, suppression                                                                                    |
| `POST`                 | `/api/tasks/:id/complete` · `/uncomplete`      | Bascule de statut ; terminer une tâche répétée engendre l'occurrence suivante                                                 |
| `POST`                 | `/api/tasks/reorder`                           | Déplacements en lot (glisser-déposer)                                                                                         |
| `GET`/`POST`           | `/api/tags` · `PATCH`/`DELETE` `/api/tags/:id` | Gestion des tags                                                                                                              |
| `GET`                  | `/api/stats/today`                             | `{ overdue, today, badge }`                                                                                                   |
| `GET`                  | `/api/health`                                  | Sonde de disponibilité                                                                                                        |

Les tags sont résolus par slug (`Montage Vidéo` → `montage-video`) et **créés à
la volée** s'ils n'existent pas : une intégration n'a pas à les déclarer.

## Architecture

Monorepo npm en Domain-Driven Design ; le détail vit dans [CLAUDE.md](CLAUDE.md).

```
packages/core   @todo/core — domaine pur partagé (entités, positions, parseur)
apps/api        Fastify + SQLite : API REST, Web Push, résumé quotidien
apps/web        React + Vite + Tailwind + shadcn/ui : la PWA
```

Le domaine est partagé, pas dupliqué : le calcul des positions du
glisser-déposer et l'analyse de la saisie rapide tournent à l'identique dans le
navigateur et sur le serveur.

## Sauvegarde

```bash
docker compose exec todo node -e "require('better-sqlite3')('/data/todo.db',{readonly:true}).prepare('VACUUM INTO ?').run('/data/backup.db')"
docker compose cp todo:/data/backup.db ./todo-backup.db
```

En local : `npm run backup -w @todo/api`.
