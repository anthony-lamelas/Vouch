import { describe, expect, it, vi } from 'vitest';
import {
  THEME_KEY,
  applyTheme,
  otherTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemTheme,
} from '../lib/theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const prefers = (dark: boolean) => ({
  matchMedia: () => ({ matches: dark }) as MediaQueryList,
});

describe('theme helper', () => {
  it('reads only valid stored values and writes under the vouch key', () => {
    const storage = memoryStorage();
    expect(readStoredTheme(storage)).toBeNull();
    storeTheme('dark', storage);
    expect(storage.map.get(THEME_KEY)).toBe('dark');
    expect(readStoredTheme(storage)).toBe('dark');
    expect(readStoredTheme(memoryStorage({ [THEME_KEY]: 'sepia' }))).toBeNull();
    expect(readStoredTheme(null)).toBeNull();
  });

  it('survives storage that throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(readStoredTheme(broken)).toBeNull();
    expect(() => storeTheme('light', broken)).not.toThrow();
    expect(() => storeTheme('light', null)).not.toThrow();
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(systemTheme(prefers(true))).toBe('dark');
    expect(systemTheme(prefers(false))).toBe('light');
    expect(systemTheme(null)).toBe('light');
    expect(resolveTheme(memoryStorage(), prefers(true))).toBe('dark');
    expect(resolveTheme(memoryStorage({ [THEME_KEY]: 'light' }), prefers(true))).toBe('light');
  });

  it('stamps the root element and flips between themes', () => {
    const root = document.createElement('html');
    const spy = vi.spyOn(root, 'setAttribute');
    applyTheme('dark', root);
    expect(spy).toHaveBeenCalledWith('data-theme', 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(() => applyTheme('light', null)).not.toThrow();
    expect(otherTheme('dark')).toBe('light');
    expect(otherTheme('light')).toBe('dark');
  });
});
