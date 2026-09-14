import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useRequests } from '../api/queries';
import { useAuth } from '../auth/context';
import { Button } from '../components/Button';
import { BriefcaseIcon, MoonIcon, PipelineIcon, SunIcon } from '../components/Icons';
import { Wordmark } from '../components/Wordmark';
import { needsYouCount, sidebarNeedsYou } from '../lib/needsYou';
import { applyTheme, otherTheme, resolveTheme, storeTheme, type Theme } from '../lib/theme';

const NAV = [
  { to: '/roles', label: 'Roles', Icon: BriefcaseIcon },
  { to: '/pipeline', label: 'Pipeline', Icon: PipelineIcon },
] as const;

/** The current theme and a toggle that stamps <html>, persists, and re-renders. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme());
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = otherTheme(current);
      applyTheme(next);
      storeTheme(next);
      return next;
    });
  }, []);
  return [theme, toggle];
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-haze hover:text-ink"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const mine = useRequests({ mine: true, active_only: true });
  const active = mine.data?.items;
  const count = useMemo(() => needsYouCount(active ?? []), [active]);
  const links = useMemo(() => sidebarNeedsYou(active ?? []), [active]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col bg-paper px-3 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <NavLink
            to="/roles"
            className="flex h-7 items-center rounded-[6px] px-2"
            aria-label="VOUCH home"
          >
            <Wordmark />
          </NavLink>
          <ThemeToggle />
        </div>

        <nav aria-label="Primary" className="mt-4 flex flex-col gap-0.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex h-8 items-center gap-2 rounded-[8px] px-2 text-[14px] font-medium transition-colors ${
                  isActive ? 'bg-haze text-ink' : 'text-carbon hover:bg-haze/70 hover:text-ink'
                }`
              }
            >
              <Icon className="shrink-0 text-muted" />
              <span>{label}</span>
              {to === '/pipeline' && count > 0 ? (
                <span
                  className="ml-auto rounded-tag bg-ice px-1.5 text-[12px] font-medium leading-[18px] tracking-normal text-cobalt tnum"
                  aria-label={`${count} need you`}
                >
                  {count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {links.length > 0 ? (
          <section aria-labelledby="sidebar-needs-you" className="mt-5">
            <h2
              id="sidebar-needs-you"
              className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-needs-text"
            >
              Needs you
            </h2>
            <ul className="mt-1 flex flex-col gap-0.5">
              {links.map((l) => (
                <li key={l.key}>
                  <Link
                    to={l.to}
                    className="flex h-7 items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-carbon hover:bg-haze hover:text-ink"
                  >
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-needs-rule" />
                    <span className="truncate">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-auto flex items-center gap-1 pl-2">
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-medium text-carbon"
            title={user?.email}
          >
            {me.data?.name ?? user?.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-[12px]"
            onClick={() => {
              void signOut().then(() => navigate('/login', { replace: true }));
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="w-full max-w-[1440px] px-6 pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
