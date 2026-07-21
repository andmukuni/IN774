import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Eye, PlusCircle, RefreshCw } from 'lucide-react';
import { PageHeader, Card, Spinner, LoadingButton } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();
const LIVE_POLL_MS = 5_000;

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusBadge({ status }) {
  const styles = {
    up: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    down: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  const label = status === 'up' ? 'Up' : status === 'down' ? 'Down' : 'Unknown';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[status] || styles.unknown}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  const labels = { http: 'HTTP', tcp: 'TCP', mysql: 'MySQL' };
  return (
    <span className="inline-flex rounded-md bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-700">
      {labels[type] || type}
    </span>
  );
}

function endpointLabel(target) {
  if (target.type === 'http') return target.hostOrUrl;
  const port = target.port ? `:${target.port}` : '';
  return `${target.hostOrUrl}${port}`;
}

const SPEED_TONE_CLASS = {
  fast: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  good: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  slow: 'bg-orange-100 text-orange-800 border-orange-200',
  down: 'bg-red-100 text-red-800 border-red-200',
  unknown: 'bg-navy-100 text-navy-600 border-navy-200',
};

const TRAFFIC_TONE_CLASS = {
  high: 'text-emerald-700',
  normal: 'text-cyan-700',
  low: 'text-amber-700',
  muted: 'text-navy-400',
};

function LatencySparkline({ samples = [], width = 80, height = 28 }) {
  const points = (samples || []).filter((v) => Number.isFinite(v));
  if (points.length < 2) {
    return <span className="inline-block h-7 w-20 rounded bg-navy-50" aria-hidden />;
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 text-cyan-600" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
    </svg>
  );
}

function LiveMsCell({ latencyMs, avgLatencyMs, recentLatencies = [], trend = 'flat', flash = false }) {
  const displayMs = latencyMs ?? avgLatencyMs;
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendClass = trend === 'up'
    ? 'text-amber-600'
    : trend === 'down'
      ? 'text-emerald-600'
      : 'text-navy-400';

  return (
    <div className={`flex items-center gap-2 min-w-[130px] transition-colors duration-500 ${flash ? 'rounded-lg bg-cyan-50/80 px-1 -mx-1' : ''}`}>
      <LatencySparkline samples={recentLatencies} />
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums text-navy-900">
            {displayMs != null ? displayMs : '—'}
          </span>
          {displayMs != null && <span className="text-[10px] text-navy-400">ms</span>}
          <span className={`text-[10px] font-bold ${trendClass}`} title="Latest trend">{trendSymbol}</span>
        </div>
        {avgLatencyMs != null && displayMs != null && avgLatencyMs !== displayMs && (
          <p className="text-[10px] tabular-nums text-navy-400">avg {avgLatencyMs} ms</p>
        )}
      </div>
    </div>
  );
}

function SpeedTrafficCell({ speed, traffic }) {
  const speedTone = SPEED_TONE_CLASS[speed?.tone] || SPEED_TONE_CLASS.unknown;
  const trafficTone = TRAFFIC_TONE_CLASS[traffic?.tone] || TRAFFIC_TONE_CLASS.normal;

  return (
    <div className="min-w-[108px] space-y-1">
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${speedTone}`}>
        {speed?.label || '—'}
      </span>
      <p className={`text-xs font-medium tabular-nums ${trafficTone}`}>
        {traffic?.label || '—'}
        {traffic?.checksLastHour != null && (
          <span className="text-navy-400 font-normal">
            {' · '}
            {traffic.checksLastHour}
            /hr
          </span>
        )}
      </p>
    </div>
  );
}

export default function MonitorListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canView = hasPermission('monitor.view');
  const canManage = hasPermission('monitor.manage');

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [checkingId, setCheckingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flashIds, setFlashIds] = useState(new Set());

  const loadTargets = useCallback(async (silent = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/admin/monitor`, {
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to load monitor targets');
      const next = Array.isArray(json.data) ? json.data : [];
      setTargets((prev) => {
        const changed = new Set();
        for (const row of next) {
          const old = prev.find((p) => p.id === row.id);
          if (old && old.lastLatencyMs !== row.lastLatencyMs) {
            changed.add(row.id);
          }
        }
        if (changed.size) {
          setFlashIds(changed);
          window.setTimeout(() => setFlashIds(new Set()), 700);
        }
        return next;
      });
    } catch (err) {
      toast.error(err?.message || 'Unable to load monitor targets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, toast]);

  useEffect(() => {
    loadTargets();
    const interval = setInterval(() => loadTargets(true), LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [loadTargets]);

  const summary = useMemo(() => ({
    total: targets.length,
    up: targets.filter((t) => t.status === 'up').length,
    down: targets.filter((t) => t.status === 'down').length,
    unknown: targets.filter((t) => t.status === 'unknown').length,
  }), [targets]);

  const handleCheckNow = async (id) => {
    setCheckingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/monitor/${id}/check`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Check failed');
      toast.success('Check completed.');
      await loadTargets(true);
    } catch (err) {
      toast.error(err?.message || 'Unable to run check.');
    } finally {
      setCheckingId(null);
    }
  };

  if (!canView) {
    return (
      <Card title="Access denied">
        <p className="text-sm text-navy-600">You do not have permission to view the servers &amp; database monitor.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servers & DB Monitor"
        subtitle="Track reachability of URLs, servers, and MySQL databases"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Monitor' },
        ]}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <LoadingButton
              type="button"
              loading={refreshing}
              onClick={() => loadTargets(true)}
              className="px-4 py-2 rounded-xl border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              <RefreshCw size={16} />
              Refresh
            </LoadingButton>
            {canManage && (
              <Link
                to="/admin/monitor/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
              >
                <PlusCircle size={16} />
                Add target
              </Link>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total" className="!p-4">
          <p className="text-2xl font-bold text-navy-900">{summary.total}</p>
        </Card>
        <Card title="Up" className="!p-4">
          <p className="text-2xl font-bold text-emerald-600">{summary.up}</p>
        </Card>
        <Card title="Down" className="!p-4">
          <p className="text-2xl font-bold text-red-600">{summary.down}</p>
        </Card>
        <Card title="Unknown" className="!p-4">
          <p className="text-2xl font-bold text-amber-600">{summary.unknown}</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <Card title="Monitored targets" noPadding>
          {targets.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="mx-auto mb-3 text-navy-300" size={32} />
              <p className="text-sm text-navy-600">No targets yet. Add a URL, IP/host, or database to start monitoring.</p>
              {canManage && (
                <Link
                  to="/admin/monitor/new"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-600 hover:text-cyan-500"
                >
                  <PlusCircle size={16} />
                  Add your first target
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Endpoint</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last check</th>
                    <th className="px-4 py-3 font-semibold">Live (ms)</th>
                    <th className="px-4 py-3 font-semibold">Speed / traffic</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {targets.map((target) => (
                    <tr key={target.id} className="hover:bg-navy-50/60">
                      <td className="px-4 py-3">
                        <Link to={`/admin/monitor/${target.id}`} className="font-medium text-cyan-700 hover:text-cyan-600">
                          {target.name}
                        </Link>
                        {!target.enabled && (
                          <span className="ml-2 text-xs text-navy-400">(disabled)</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><TypeBadge type={target.type} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-navy-700 max-w-xs truncate">{endpointLabel(target)}</td>
                      <td className="px-4 py-3"><StatusBadge status={target.status} /></td>
                      <td className="px-4 py-3 text-navy-600 whitespace-nowrap">{formatDateTime(target.lastCheckedAt)}</td>
                      <td className="px-4 py-3">
                        <LiveMsCell
                          latencyMs={target.lastLatencyMs}
                          avgLatencyMs={target.avgLatencyMs}
                          recentLatencies={target.recentLatencies}
                          trend={target.latencyTrend}
                          flash={flashIds.has(target.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SpeedTrafficCell speed={target.speed} traffic={target.traffic} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {canManage && (
                            <button
                              type="button"
                              disabled={checkingId === target.id}
                              onClick={() => handleCheckNow(target.id)}
                              title="Check now"
                              aria-label="Check now"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {checkingId === target.id ? (
                                <Spinner size={16} />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                            </button>
                          )}
                          <Link
                            to={`/admin/monitor/${target.id}`}
                            title="View"
                            aria-label="View"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
                          >
                            <Eye size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
