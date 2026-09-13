import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { configureApi } from '../api/client';
import type { AppConfig } from '../api/types';
import { loadAppConfig } from './config';
import { AuthContext, type AuthState, type AuthUser } from './context';

const DEMO_USER: AuthUser = { email: 'recruiter@vouch.local' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAppConfig().then(
      (cfg) => {
        if (!cancelled) setConfig(cfg);
      },
      (err: unknown) => {
        if (!cancelled)
          setConfigError(err instanceof Error ? err.message : 'Could not reach the API');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    if (config.auth_disabled || !config.supabase_url || !config.supabase_anon_key) {
      clientRef.current = null;
      configureApi({ getToken: () => Promise.resolve(null), onUnauthorized: () => undefined });
      setSessionChecked(true);
      return;
    }
    const client = createClient(config.supabase_url, config.supabase_anon_key);
    clientRef.current = client;
    configureApi({
      getToken: async () => {
        const { data } = await client.auth.getSession();
        return data.session?.access_token ?? null;
      },
      onUnauthorized: () => {
        void client.auth.signOut();
      },
    });
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [config]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = clientRef.current;
    if (!client) throw new Error('Sign-in is not configured for this environment.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    const client = clientRef.current;
    if (client) await client.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const authDisabled = config?.auth_disabled ?? false;
    const user: AuthUser | null = authDisabled
      ? DEMO_USER
      : session?.user.email
        ? { email: session.user.email }
        : null;
    return {
      ready: Boolean(config) && sessionChecked,
      configError,
      config,
      user,
      signIn,
      signOut,
    };
  }, [config, configError, session, sessionChecked, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
