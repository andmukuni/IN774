import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-navy-50 to-white">
      <header className="shrink-0 border-b border-navy-100 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-lg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Goodfellow Finance</p>
          <h1 className="text-lg font-bold text-navy-900">Branch equipment report</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
