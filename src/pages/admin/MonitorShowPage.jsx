import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, LoadingButton } from '../../components/ui';
import RecordShowActions from '../../components/admin/RecordShowActions';
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

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function StatusBadge({ status }) {
  const styles = {
    up: 'bg-emerald-100 text-emerald-800',
    down: 'bg-red-100 text-red-800',
    unknown: 'bg-amber-100 text-amber-800',
  };
  const label = status === 'up' ? 'Up' : status === 'down' ? 'Down' : 'Unknown';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[status] || styles.unknown}`}>
      {label}
    </span>
  );
}

export default function MonitorShowPage() {
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('monitor.manage');

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [data, setData] = useState(null);
  const [reportDays, setReportDays] = useState(7);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(Date.now() - reportDays * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();
      const [detailRes, reportRes] = await Promise.all([
        fetch(`${API_BASE}/admin/monitor/${id}`, { headers: getAdminAuthHeaders(), cache: 'no-store' }),
        fetch(`${API_BASE}/admin/monitor/${id}/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        }),
      ]);
      const detailJson = await detailRes.json().catch(() => ({}));
      const reportJson = await reportRes.json().catch(() => ({}));
      if (!detailRes.ok || !detailJson?.ok) throw new Error(detailJson?.message || 'Failed to load target');
      if (!reportRes.ok || !reportJson?.ok) throw new Error(reportJson?.message || 'Failed to load report');
      setData({
        ...detailJson.data,
        report: reportJson.data,
      });
    } catch (err) {
      toast.error(err?.message || 'Unable to load monitor target.');
    } finally {
      setLoading(false);
    }
  }, [id, reportDays, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/admin/monitor/${id}/check`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Check failed');
      toast.success('Check completed.');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Unable to run check.');
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`${API_BASE}/admin/monitor/${id}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to delete target');
    toast.success('Target deleted.');
    window.location.href = '/admin/monitor';
  };

  const target = data?.target;
  const checks = data?.checks || [];
  const incidents = data?.report?.incidents || data?.incidents || [];
  const report = data?.report;

  return (
    <div className="space-y-6">
      <PageHeader
        title={target?.name || 'Monitor target'}
        subtitle={target ? `${target.type.toUpperCase()} · ${target.hostOrUrl}` : 'Loading…'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Monitor', to: '/admin/monitor' },
          { label: target?.name || 'View' },
        ]}
        actions={target && (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <LoadingButton type="button" loading={checking} onClick={handleCheckNow} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium">
                Check now
              </LoadingButton>
            )}
            <RecordShowActions
              backTo="/admin/monitor"
              backLabel="Back to monitor"
              editTo={canManage ? `/admin/monitor/${id}/edit` : undefined}
              onDelete={canManage ? handleDelete : undefined}
              deleteTitle="Delete monitor target"
              deleteMessage={`Delete ${target.name}? History and incidents will be removed.`}
            />
          </div>
        )}
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {!loading && target && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Current status" className="!p-4">
              <StatusBadge status={target.status} />
              <p className="mt-3 text-sm text-navy-600">
                Last checked: {formatDateTime(target.lastCheckedAt)}
              </p>
              {target.lastLatencyMs != null && (
                <p className="text-sm text-navy-600">Latency: {target.lastLatencyMs} ms</p>
              )}
              {target.lastError && (
                <p className="mt-2 text-sm text-red-600 break-words">{target.lastError}</p>
              )}
            </Card>

            <Card title="Uptime report" className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                {[7, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setReportDays(days)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                      reportDays === days
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {report?.uptimePercent != null ? `${report.uptimePercent}%` : '—'}
              </p>
              <p className="mt-2 text-sm text-navy-600">
                Downtime: {formatDuration(report?.downtimeMs)}
              </p>
              <p className="text-sm text-navy-600">
                Incidents: {report?.incidentCount ?? 0}
              </p>
            </Card>

            <Card title="Configuration" className="!p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Interval</dt>
                  <dd className="text-navy-900">{target.intervalSeconds}s</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Timeout</dt>
                  <dd className="text-navy-900">{target.timeoutMs} ms</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Enabled</dt>
                  <dd className="text-navy-900">{target.enabled ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Alert email</dt>
                  <dd className="text-navy-900 break-all">{target.notifyEmail || '—'}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card title="Recent checks" noPadding>
            {checks.length === 0 ? (
              <p className="p-6 text-sm text-navy-600">No checks recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Time</th>
                      <th className="px-4 py-3 font-semibold">Result</th>
                      <th className="px-4 py-3 font-semibold">Latency</th>
                      <th className="px-4 py-3 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {checks.map((check) => (
                      <tr key={check.id}>
                        <td className="px-4 py-3 text-navy-700">{formatDateTime(check.checkedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={check.ok ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                            {check.ok ? 'OK' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy-600">
                          {check.latencyMs != null ? `${check.latencyMs} ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-red-600 break-words max-w-md">{check.error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Incidents" noPadding>
            {incidents.length === 0 ? (
              <p className="p-6 text-sm text-navy-600">No incidents in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Started</th>
                      <th className="px-4 py-3 font-semibold">Ended</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Last error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td className="px-4 py-3 text-navy-700">{formatDateTime(incident.startedAt)}</td>
                        <td className="px-4 py-3 text-navy-700">{formatDateTime(incident.endedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={incident.open ? 'text-red-700 font-medium' : 'text-navy-700'}>
                            {incident.open ? 'Open' : 'Resolved'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-600 break-words max-w-md">{incident.lastError || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
