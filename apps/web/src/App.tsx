import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthGate } from '@/presentation/components/layout/auth-gate';
import { InboxPage } from '@/presentation/pages/inbox-page';
import { TodayPage } from '@/presentation/pages/today-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les données viennent d'un serveur local : un rafraîchissement au
      // retour sur l'app suffit, inutile de marteler le réseau.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthGate>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </AuthGate>
      </Router>
      <Toaster position="top-center" theme="dark" richColors closeButton />
    </QueryClientProvider>
  );
}
