import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '@/infrastructure/http/client';
import { systemApi } from '@/infrastructure/system/system-api';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';

export const authKeys = { status: ['auth', 'status'] as const };

/**
 * Affiche l'écran de saisie du mot de passe tant que la session n'est pas
 * ouverte. Quand aucun `APP_PASSWORD` n'est configuré côté serveur, cet écran
 * ne s'affiche jamais : l'instance est alors en mode réseau de confiance.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data: status, isPending } = useQuery({
    queryKey: authKeys.status,
    queryFn: () => systemApi.authStatus(),
    retry: false,
    staleTime: Infinity,
  });

  if (isPending) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground" />;
  }

  if (status?.authRequired && !status.authenticated) return <LoginScreen />;

  return <>{children}</>;
}

function LoginScreen() {
  const client = useQueryClient();
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: (value: string) => systemApi.login(value),
    onSuccess: () => void client.invalidateQueries({ queryKey: authKeys.status }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length > 0) login.mutate(password);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 pb-2 text-center">
          <div className="rounded-full bg-secondary p-3">
            <Lock className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">Todo</h1>
          <p className="text-sm text-muted-foreground">
            Cette instance est protégée par un mot de passe.
          </p>
        </div>

        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {login.error && (
          <p className="text-sm text-destructive">
            {login.error instanceof ApiError ? login.error.message : 'Connexion impossible'}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </div>
  );
}
