/**
 * Light/dark theme. The choice is stored under `vouch.theme`; with nothing stored we follow
 * the OS. `index.html` applies the stored value before first paint so there is no flash.
 */

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'vouch.theme';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The user's stored choice, or null when unset, unreadable or malformed. */
export function readStoredTheme(storage: StorageLike | null = defaultStorage()): Theme | null {
  try {
    const raw = storage?.getItem(THEME_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persists the choice; silently does nothing when storage is unavailable or full. */
export function storeTheme(theme: Theme, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // Private mode, quota, or blocked storage: the in-page theme still applies.
  }
}

export function systemTheme(win: Pick<Window, 'matchMedia'> | null = globalWindow()): Theme {
  try {
    return win?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function globalWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

/** Stored choice first, otherwise the OS preference. */
export function resolveTheme(
  storage: StorageLike | null = defaultStorage(),
  win: Pick<Window, 'matchMedia'> | null = globalWindow(),
): Theme {
  return readStoredTheme(storage) ?? systemTheme(win);
}

/** Stamps `data-theme` on the root element so the CSS variables switch. */
export function applyTheme(theme: Theme, root: Element | null = rootElement()): void {
  root?.setAttribute('data-theme', theme);
}

function rootElement(): Element | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
