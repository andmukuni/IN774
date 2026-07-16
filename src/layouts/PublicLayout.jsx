import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  useEffect(() => {
    document.documentElement.classList.add('intake-mobile');
    return () => document.documentElement.classList.remove('intake-mobile');
  }, []);

  return (
    <div className="intake-shell flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-navy-50 to-white">
      <header className="sticky top-0 z-20 shrink-0 border-b border-navy-100 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-lg min-w-0 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Goodfellow Finance</p>
          <h1 className="text-base font-bold text-navy-900 sm:text-lg">Branch equipment report</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col px-4 py-4 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
