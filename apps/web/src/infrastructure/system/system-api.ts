import { http } from '../http/client.js';

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
  pushEnabled: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const systemApi = {
  authStatus: () => http.get<AuthStatus>('/api/auth/status'),
  login: (password: string) => http.post<{ ok: boolean }>('/api/auth/login', { password }),
  logout: () => http.post<{ ok: boolean }>('/api/auth/logout'),

  listApiKeys: () => http.get<{ keys: ApiKey[] }>('/api/api-keys').then((payload) => payload.keys),
  /** La clé en clair n'est renvoyée qu'ici : elle n'est plus jamais lisible ensuite. */
  createApiKey: (name: string) => http.post<ApiKey & { key: string }>('/api/api-keys', { name }),
  deleteApiKey: (id: string) => http.delete<void>(`/api/api-keys/${id}`),

  vapidPublicKey: () =>
    http.get<{ enabled: boolean; publicKey: string | null }>('/api/push/vapid-public-key'),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    http.post<{ ok: boolean }>('/api/push/subscription', subscription),
  unsubscribePush: (endpoint: string) => http.delete<void>('/api/push/subscription', { endpoint }),
  sendTestPush: () => http.post<{ sent: number; enabled: boolean }>('/api/push/test'),
};
