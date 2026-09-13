import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApiError } from './api/client';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OutreachPage } from './pages/OutreachPage';
import { PipelinePage } from './pages/PipelinePage';
import { RequestPage } from './pages/RequestPage';
import { RoleDetailPage } from './pages/RoleDetailPage';
import { RolesPage } from './pages/RolesPage';

function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return count < 2;
        },
      },
    },
  });
}

const queryClient = createAppQueryClient();

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/roles" replace />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/roles/:id" element={<RoleDetailPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/requests/:id" element={<RequestPage />} />
          <Route path="/outreach" element={<OutreachPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
