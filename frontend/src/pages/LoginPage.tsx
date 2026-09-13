import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Button } from '../components/Button';
import { FullPageNotice } from '../components/FullPageNotice';
import { Wordmark } from '../components/Wordmark';

export function LoginPage() {
  const { ready, user, config, configError, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/roles';

  if (configError) {
    return (
      <FullPageNotice title="Can't reach the API">
        {configError}. Check that the backend is running, then reload.
      </FullPageNotice>
    );
  }
  if (!ready) return <FullPageNotice title="Loading VOUCH" muted />;
  if (user) return <Navigate to={from} replace />;

  const configured = Boolean(config?.supabase_url && config.supabase_anon_key);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-ground px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6">
          <Wordmark size="lg" />
          <p className="mt-2 text-muted">Referral sourcing for Cognition recruiters.</p>
        </div>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="rounded-md border border-line bg-surface p-5 space-y-4"
          noValidate
        >
          {!configured ? (
            <div
              role="alert"
              className="rounded border border-neg/30 bg-neg-soft px-3 py-2 text-[12.5px] text-neg"
            >
              Sign-in isn&apos;t configured: the API did not return Supabase settings from{' '}
              <code>/api/config</code>. Set <code>AUTH_DISABLED=true</code> locally or configure
              Supabase on the server.
            </div>
          ) : null}
          <label className="block">
            <span className="block text-[12.5px] font-medium text-ink-2 mb-1">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full"
              disabled={!configured || busy}
              required
            />
          </label>
          <label className="block">
            <span className="block text-[12.5px] font-medium text-ink-2 mb-1">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full"
              disabled={!configured || busy}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="text-[12.5px] text-neg">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" className="w-full" disabled={!configured || busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
