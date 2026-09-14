import { useMe } from '../api/queries';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Wordmark } from '../components/Wordmark';

const NAV = [
  { to: '/roles', label: 'Roles' },
  { to: '/pipeline', label: 'Pipeline' },
];

export function AppShell() {
  const { user, config, signOut } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const demo = config?.auth_disabled ?? false;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 h-12 bg-surface border-b border-line">
        <div className="mx-auto max-w-[1400px] h-full px-6 flex items-center gap-6">
          <NavLink to="/roles" className="flex items-center gap-2 pr-2" aria-label="VOUCH home">
            <Wordmark />
          </NavLink>
          <nav aria-label="Primary" className="flex items-center gap-1 h-full">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative h-full inline-flex items-center px-3 text-[13px] font-medium transition-colors ${
                    isActive ? 'text-ink' : 'text-muted hover:text-ink'
                  } after:absolute after:left-3 after:right-3 after:-bottom-px after:h-[2px] ${
                    isActive ? 'after:bg-accent' : 'after:bg-transparent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[12.5px]">
            {demo ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn-soft px-2.5 py-0.5 text-[11.5px] font-medium text-warn"
                title="AUTH_DISABLED is set on the API; every request runs as the local recruiter."
              >
                <span className="size-1.5 rounded-full bg-warn" aria-hidden />
                Local demo mode
              </span>
            ) : null}
            <span className="text-ink-2" title={user?.email ?? undefined}>
              {me.data?.name ?? user?.email}
            </span>
            {!demo ? (
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => navigate('/login', { replace: true }));
                }}
                className="rounded border border-line-2 bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-ground"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}
