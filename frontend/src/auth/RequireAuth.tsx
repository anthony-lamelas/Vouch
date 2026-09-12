import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context';
import { FullPageNotice } from '../components/FullPageNotice';

export function RequireAuth() {
  const { ready, user, configError } = useAuth();
  const location = useLocation();
  if (configError) {
    return (
      <FullPageNotice title="Can't reach the API">
        {configError}. Check that the backend is running, then reload.
      </FullPageNotice>
    );
  }
  if (!ready) return <FullPageNotice title="Loading VOUCH" muted />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
