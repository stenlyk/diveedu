import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

const NAV = [
  { to: '/', label: 'Domů', end: true, icon: icon(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>) },
  { to: '/uceni', label: 'Učení', icon: icon(<><path d="M4 5.5c3-1.2 5.5-1 8 .8 2.5-1.8 5-2 8-.8v13c-3-1.2-5.5-1-8 .8-2.5-1.8-5-2-8-.8z" /><path d="M12 6.3v13" /></>) },
  { to: '/trenink', label: 'Trénink', icon: icon(<><circle cx="12" cy="13" r="7.5" /><path d="M12 13V9M9.5 2.5h5" /></>) },
  { to: '/graf', label: 'Graf', icon: icon(<><circle cx="5.5" cy="12" r="2.5" /><circle cx="18" cy="5.5" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m7.7 10.8 8-4M7.7 13.2l8 4" /></>) },
  { to: '/nastroje', label: 'Nástroje', icon: icon(<><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h1M12 12h1M15.5 12h0M8.5 16h1M12 16h1M15.5 16h0" /></>) },
];

const settingsIcon = icon(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>);

export function AppShell() {
  return (
    <div className="min-h-dvh md:pl-56">
      <a href="#obsah" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">Přeskočit na obsah</a>

      {/* Desktop: boční panel */}
      <nav aria-label="Hlavní navigace" className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-surface p-4 md:flex" data-testid="side-nav">
        <div className="mb-6 px-2 text-xl font-bold tracking-tight">DiveEdu</div>
        <ul className="flex-1 space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}>
                {item.icon}{item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink to="/nastaveni" className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}>
          {settingsIcon}Nastavení
        </NavLink>
      </nav>

      {/* Mobil: horní lišta jen s nastavením */}
      <header className="flex items-center justify-between px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] md:hidden">
        <span className="text-sm font-semibold text-muted">DiveEdu</span>
        <NavLink to="/nastaveni" aria-label="Nastavení" className={({ isActive }) => `flex h-12 w-12 items-center justify-center rounded-xl ${isActive ? 'text-accent' : 'text-muted'}`}>{settingsIcon}</NavLink>
      </header>

      <main id="obsah" className="mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-5xl flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 md:min-h-dvh md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Mobil: spodní navigace v dosahu palce */}
      <nav aria-label="Hlavní navigace" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-testid="bottom-nav">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-accent' : 'text-muted'}`}>
                {item.icon}{item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
