import { ApiError, request } from '../api/client';
import type { AppConfig, MeOut } from '../api/types';

export const FALLBACK_CONFIG: AppConfig = {
  supabase_url: '',
  supabase_anon_key: '',
  auth_disabled: false,
  slack_enabled: false,
  app_name: 'VOUCH',
};

/**
 * Runtime config comes from the API so one build works in every environment.
 * If the deployed API predates /api/config, fall back to probing /api/me without a token:
 * a 200 means auth is disabled; a 401 means auth is on but we have no Supabase settings,
 * which the login page reports plainly.
 */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const cfg = await request<AppConfig>('/config', { anonymous: true });
    return { ...FALLBACK_CONFIG, ...cfg };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  try {
    const me = await request<MeOut>('/me', { anonymous: true });
    return { ...FALLBACK_CONFIG, auth_disabled: me.auth_disabled };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return FALLBACK_CONFIG;
    throw err;
  }
}
