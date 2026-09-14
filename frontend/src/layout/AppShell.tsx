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
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 h-12 border-b border-line bg-surface">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-8 px-6">
          <NavLink to="/roles" className="rounded-[2px]" aria-label="VOUCH home">
            <Wordmark />
          </NavLink>
          <nav aria-label="Primary" className="flex h-full items-center gap-5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative inline-flex h-full items-center text-[14px] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] ${
                    isActive
                      ? 'text-spruce after:bg-spruce'
                      : 'text-ink-2 hover:text-ink after:bg-transparent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[13.5px]">
            {demo ? (
              <span
                className="rounded-control bg-ochre-soft px-2 font-medium leading-[20px] text-ochre"
                title="AUTH_DISABLED is set on the API; every request runs as the local recruiter."
              >
                Demo
              </span>
            ) : null}
            <span className="text-ink-2" title={user?.email}>
              {me.data?.name ?? user?.email}
            </span>
            {!demo ? (
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => navigate('/login', { replace: true }));
                }}
                className="rounded-control px-1.5 py-0.5 font-medium text-ink-2 hover:bg-neutral-soft hover:text-ink"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
