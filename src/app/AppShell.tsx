import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

const NAV = [
  { to: '/', label: 'Domů', end: true, icon: icon(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>) },
  { to: '/uceni', label: 'Učení', icon: icon(<><path d="M4 5.5c3-1.2 5.5-1 8 .8 2.5-1.8 5-2 8-.8v13c-3-1.2-5.5-1-8 .8-2.5-1.8-5-2-8-.8z" /><path d="M12 6.3v13" /></>) },
  { to: '/trenink', label: 'Trénink', icon: icon(<><circle cx="12" cy="13" r="7.5" /><path d="M12 13V9M9.5 2.5h5" /></>) },
  { to: '/graf', label: 'Graf', icon: icon(<><circle cx="5.5" cy="12" r="2.5" /><circle cx="18" cy="5.5" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m7.7 10.8 8-4M7.7 13.2l8 4" /></>) },
  { to: '/nastroje', label: 'Nástroje', icon: icon(<><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h1M12 12h1M15.5 12h0M8.5 16h1M12 16h1M15.5 16h0" /></>) },
];

const settingsIcon = icon(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>);

/** Je aplikace uložená v zařízení (service worker řídí stránku)? Údaj, ne slib: jen to, co prohlížeč opravdu hlásí. */
function useOfflineReady(): boolean {
  const [ready, setReady] = useState(() => typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const update = () => setReady(!!sw.controller);
    sw.addEventListener('controllerchange', update);
    void sw.ready.then(update).catch(() => undefined);
    return () => sw.removeEventListener('controllerchange', update);
  }, []);
  return ready;
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded border border-accent font-mono text-xs text-accent">DE</span>
      DiveEdu
    </span>
  );
}

function OfflineStatus({ ready }: { ready: boolean }) {
  if (!ready) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-1 text-[0.6875rem] text-muted" data-testid="offline-ready">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ok" />Offline připraveno
    </span>
  );
}

const sideItem = ({ isActive }: { isActive: boolean }) =>
  `relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium ${isActive ? 'bg-surface-3 text-text before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`;

export function AppShell() {
  const offlineReady = useOfflineReady();
  return (
    <div className="min-h-dvh md:pl-56">
      <a href="#obsah" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">Přeskočit na obsah</a>

      {/* Desktop: boční panel */}
      <nav aria-label="Hlavní navigace" className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-surface p-4 md:flex" data-testid="side-nav">
        <div className="mb-2 px-2 text-lg"><Brand /></div>
        <div className="mb-6 px-2"><OfflineStatus ready={offlineReady} /></div>
        <ul className="flex-1 space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={sideItem}>
                {item.icon}{item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink to="/nastaveni" className={sideItem}>
          {settingsIcon}Nastavení
        </NavLink>
      </nav>

      {/* Mobil: horní lišta jen s nastavením */}
      <header className="mb-2 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Brand />
        <span className="flex items-center gap-1">
          <OfflineStatus ready={offlineReady} />
          <NavLink to="/nastaveni" aria-label="Nastavení" className={({ isActive }) => `flex h-12 w-12 items-center justify-center rounded-xl ${isActive ? 'text-accent' : 'text-muted'}`}>{settingsIcon}</NavLink>
        </span>
      </header>

      <main id="obsah" className="mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-5xl flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 md:min-h-dvh md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Mobil: spodní navigace v dosahu palce */}
      <nav aria-label="Hlavní navigace" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" data-testid="bottom-nav">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => `relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-wide ${isActive ? 'text-accent before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent' : 'text-muted'}`}>
                {item.icon}{item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
