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
      setError(
        err instanceof Error
          ? `${err.message}. Check the address and password, then try again.`
          : 'Sign-in failed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="w-full max-w-[320px]">
        <Wordmark size="lg" />
        <p className="mt-2 text-[15px] text-ink-2">Warm referrals from your team's network.</p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4" noValidate>
          {!configured ? (
            <p role="alert" className="text-[13.5px] text-neg">
              Sign-in is not configured: the API did not return Supabase settings. Set
              AUTH_DISABLED=true locally or configure Supabase on the server.
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-medium text-ink-2">Email</span>
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
            <span className="mb-1 block text-[13.5px] font-medium text-ink-2">Password</span>
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
            <p role="alert" className="text-[13.5px] text-neg">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" className="w-full" disabled={!configured || busy}>
            {busy ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
