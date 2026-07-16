import { Activity, Database, Server } from 'lucide-react';

function HealthCard({ icon: Icon, label, value, ok, subtitle }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-lg p-2 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Icon size={18} />
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {ok ? 'Online' : 'Offline'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-navy-900">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-navy-500">{subtitle}</p>}
    </div>
  );
}

export default function SystemHealthCards({ health }) {
  if (!health) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <HealthCard
        icon={Server}
        label="API server"
        value="Running"
        ok={health.apiOk}
        subtitle={`Version ${health.version || '1.0.0'}`}
      />
      <HealthCard
        icon={Database}
        label="Database"
        value={health.dbOk ? 'Connected' : 'Unavailable'}
        ok={health.dbOk}
        subtitle="MySQL inventory store"
      />
      <HealthCard
        icon={Activity}
        label="System status"
        value={health.apiOk && health.dbOk ? 'Healthy' : 'Degraded'}
        ok={health.apiOk && health.dbOk}
        subtitle="Combined health check"
      />
    </div>
  );
}
