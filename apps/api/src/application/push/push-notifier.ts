import { today, type Task, type TodayStats } from '@todo/core';
import type { PushPayload, PushSender } from '../../domain/notifications.js';
import type { PushSubscriptionRepository } from '../../domain/repositories.js';
import type { GetTodayStats } from '../task/usecases/move-tasks.js';

export class PushNotifier {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly sender: PushSender,
    private readonly stats: GetTodayStats,
  ) {}

  get enabled(): boolean {
    return this.sender.enabled;
  }

  /**
   * Résumé quotidien : c'est le seul moment où la pastille iOS peut être
   * rafraîchie sans que l'app soit ouverte. Rien n'est envoyé s'il n'y a
   * aucune tâche à traiter, pour ne pas notifier dans le vide.
   */
  async sendDailyDigest(now: Date = new Date()): Promise<number> {
    const stats = this.stats.execute(now);
    if (stats.badge === 0) return 0;

    return this.broadcast({
      title: describeBadge(stats),
      body: stats.overdue > 0 ? `Dont ${stats.overdue} en retard` : 'Bonne journée !',
      badge: stats.badge,
      url: '/today',
      tag: 'daily-digest',
    });
  }

  /**
   * Notifie l'arrivée d'une tâche créée par une intégration (AyLabs) pour
   * aujourd'hui ou déjà en retard : sans push, la pastille resterait figée
   * jusqu'à la prochaine ouverture de l'app.
   */
  async notifyExternalTask(task: Task, now: Date = new Date()): Promise<number> {
    if (task.dueDate === null || task.dueDate > today(now)) return 0;

    const stats = this.stats.execute(now);
    return this.broadcast({
      title: 'Nouvelle tâche',
      body: task.title,
      badge: stats.badge,
      url: '/today',
      tag: 'external-task',
    });
  }

  /** Envoie à tous les appareils et purge les abonnements expirés. */
  async broadcast(payload: PushPayload): Promise<number> {
    if (!this.sender.enabled) return 0;

    const targets = this.subscriptions.findAll();
    const results = await Promise.all(
      targets.map(async (subscription) => ({
        subscription,
        result: await this.sender.send(subscription, payload),
      })),
    );

    let sent = 0;
    for (const { subscription, result } of results) {
      if (result === 'sent') sent += 1;
      // 404 / 410 : l'appareil a désinstallé la PWA ou révoqué l'autorisation.
      if (result === 'expired') this.subscriptions.deleteByEndpoint(subscription.endpoint);
    }
    return sent;
  }
}

function describeBadge(stats: TodayStats): string {
  return stats.badge === 1 ? "1 tâche aujourd'hui" : `${stats.badge} tâches aujourd'hui`;
}
