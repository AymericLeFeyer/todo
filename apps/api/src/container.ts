import type { Config } from './config.js';
import { openDatabase, type Db } from './infrastructure/db/connection.js';
import { SqliteTaskRepository } from './infrastructure/repositories/sqlite-task-repository.js';
import { SqliteTagRepository } from './infrastructure/repositories/sqlite-tag-repository.js';
import {
  SqliteApiKeyRepository,
  SqlitePushSubscriptionRepository,
} from './infrastructure/repositories/sqlite-push-repository.js';
import { NoopPushSender, WebPushSender } from './infrastructure/push/web-push-sender.js';
import { CreateTask } from './application/task/usecases/create-task.js';
import {
  DeleteTask,
  SetTaskCompletion,
  UpdateTask,
} from './application/task/usecases/update-task.js';
import { GetTodayStats, ListTasks, MoveTasks } from './application/task/usecases/move-tasks.js';
import {
  CreateTag,
  DeleteTag,
  ListTags,
  UpdateTag,
} from './application/tag/usecases/manage-tags.js';
import { PushNotifier } from './application/push/push-notifier.js';
import type {
  ApiKeyRepository,
  PushSubscriptionRepository,
  TagRepository,
  TaskRepository,
} from './domain/repositories.js';
import type { PushSender } from './domain/notifications.js';

/**
 * Composition root : c'est le seul endroit qui connaît à la fois les
 * interfaces du domaine et leurs implémentations SQLite. Les routes et les
 * use cases ne dépendent que des interfaces.
 */
export interface Container {
  config: Config;
  db: Db;
  repositories: {
    tasks: TaskRepository;
    tags: TagRepository;
    push: PushSubscriptionRepository;
    apiKeys: ApiKeyRepository;
  };
  sender: PushSender;
  notifier: PushNotifier;
  useCases: {
    createTask: CreateTask;
    updateTask: UpdateTask;
    setTaskCompletion: SetTaskCompletion;
    deleteTask: DeleteTask;
    listTasks: ListTasks;
    moveTasks: MoveTasks;
    todayStats: GetTodayStats;
    listTags: ListTags;
    createTag: CreateTag;
    updateTag: UpdateTag;
    deleteTag: DeleteTag;
  };
  close(): void;
}

export function createContainer(
  config: Config,
  db: Db = openDatabase(config.databasePath),
): Container {
  const tasks = new SqliteTaskRepository(db);
  const tags = new SqliteTagRepository(db);
  const push = new SqlitePushSubscriptionRepository(db);
  const apiKeys = new SqliteApiKeyRepository(db);

  const sender: PushSender = config.vapid ? new WebPushSender(config.vapid) : new NoopPushSender();
  const todayStats = new GetTodayStats(tasks);
  const notifier = new PushNotifier(push, sender, todayStats);

  return {
    config,
    db,
    repositories: { tasks, tags, push, apiKeys },
    sender,
    notifier,
    useCases: {
      createTask: new CreateTask(tasks, tags),
      updateTask: new UpdateTask(tasks, tags),
      setTaskCompletion: new SetTaskCompletion(tasks),
      deleteTask: new DeleteTask(tasks),
      listTasks: new ListTasks(tasks),
      moveTasks: new MoveTasks(tasks),
      todayStats,
      listTags: new ListTags(tags),
      createTag: new CreateTag(tags),
      updateTag: new UpdateTag(tags),
      deleteTag: new DeleteTag(tags),
    },
    close: () => db.close(),
  };
}
