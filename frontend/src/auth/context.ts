import { createContext, useContext } from 'react';
import type { AppConfig } from '../api/types';

export interface AuthUser {
  email: string;
}

export interface AuthState {
  /** Config finished loading and (if enabled) the stored session was checked. */
  ready: boolean;
  configError: string | null;
  config: AppConfig | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
