import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, PlusCircle, RefreshCw } from 'lucide-react';
import { PageHeader, Card, Spinner, LoadingButton } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

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

export default function MonitorListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canView = hasPermission('monitor.view');
  const canManage = hasPermission('monitor.manage');

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [checkingId, setCheckingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
      setTargets(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      toast.error(err?.message || 'Unable to load monitor targets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, toast]);

  useEffect(() => {
    loadTargets();
    const interval = setInterval(() => loadTargets(true), 30_000);
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
                    <th className="px-4 py-3 font-semibold">Latency</th>
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
                      <td className="px-4 py-3 text-navy-600">{formatDateTime(target.lastCheckedAt)}</td>
                      <td className="px-4 py-3 text-navy-600">
                        {target.lastLatencyMs != null ? `${target.lastLatencyMs} ms` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManage && (
                            <LoadingButton
                              type="button"
                              loading={checkingId === target.id}
                              onClick={() => handleCheckNow(target.id)}
                              className="px-3 py-1.5 rounded-lg border border-navy-200 text-xs font-medium text-navy-700 hover:bg-navy-50"
                            >
                              Check now
                            </LoadingButton>
                          )}
                          <Link
                            to={`/admin/monitor/${target.id}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-navy-200 text-xs font-medium text-navy-700 hover:bg-navy-50"
                          >
                            View
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
