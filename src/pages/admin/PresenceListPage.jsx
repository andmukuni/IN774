import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, RefreshCw, Search } from 'lucide-react';
import { PageHeader, Card, Spinner, LoadingButton } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

function formatRelativeTime(value) {
  if (!value) return '—';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusBadge({ status }) {
  const isOnline = status === 'online';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        isOnline
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : 'bg-red-100 text-red-800 border-red-200'
      }`}
    >
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

function SummaryCard({ label, value, tone = 'default' }) {
  const tones = {
    default: 'border-navy-200 bg-white text-navy-900',
    online: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    offline: 'border-red-200 bg-red-50 text-red-900',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.default}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function PresenceListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canView = hasPermission('presence.view');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [liveTick, setLiveTick] = useState(0);

  const loadDevices = useCallback(async (silent = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('limit', '200');

      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/admin/presence?${params.toString()}`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/admin/presence/summary`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        }),
      ]);

      const listJson = await listRes.json().catch(() => ({}));
      const summaryJson = await summaryRes.json().catch(() => ({}));

      if (!listRes.ok || !listJson?.ok) {
        throw new Error(listJson?.message || 'Failed to load devices');
      }

      setDevices(Array.isArray(listJson.data) ? listJson.data : []);
      if (summaryRes.ok && summaryJson?.ok) {
        setSummary(summaryJson.data || { total: 0, online: 0, offline: 0 });
      }
    } catch (err) {
      toast.error(err?.message || 'Unable to load PC presence data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, statusFilter, search, toast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!canView) return undefined;
    const interval = setInterval(() => loadDevices(true), 30_000);
    return () => clearInterval(interval);
  }, [canView, loadDevices]);

  useEffect(() => {
    const interval = setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredSummary = useMemo(() => {
    if (!statusFilter) return summary;
    return {
      total: devices.length,
      online: devices.filter((d) => d.onlineStatus === 'online').length,
      offline: devices.filter((d) => d.onlineStatus === 'offline').length,
    };
  }, [devices, statusFilter, summary]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Devices Online" subtitle="PC presence monitoring" />
        <Card>
          <p className="text-sm text-navy-600">You do not have permission to view PC presence.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices Online"
        subtitle="Track which Windows PCs are connected and in use across the organization."
        actions={(
          <LoadingButton
            type="button"
            variant="secondary"
            loading={refreshing}
            onClick={() => loadDevices(true)}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </LoadingButton>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total devices" value={filteredSummary.total} />
        <SummaryCard label="Online now" value={filteredSummary.online} tone="online" />
        <SummaryCard label="Offline" value={filteredSummary.offline} tone="offline" />
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-navy-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search hostname, serial, user, branch…"
                className="w-full rounded-lg border border-navy-200 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            {['', 'online', 'offline'].map((value) => {
              const label = value === '' ? 'All' : value === 'online' ? 'Online' : 'Offline';
              const active = statusFilter === value;
              return (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-cyan-600 text-white'
                      : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <Monitor className="h-10 w-10 text-navy-300" />
            <div>
              <p className="font-medium text-navy-800">No devices reporting yet</p>
              <p className="mt-1 max-w-md text-sm text-navy-500">
                Install the GFL Presence agent on Windows PCs. They will appear here once they send their first heartbeat.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-100">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-navy-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Hostname</th>
                  <th className="px-4 py-3">Serial</th>
                  <th className="px-4 py-3">Logged-in user</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {devices.map((device) => (
                  <tr key={device.id} className="text-sm text-navy-800 hover:bg-navy-50/60">
                    <td className="px-4 py-3">
                      <StatusBadge status={device.onlineStatus} />
                    </td>
                    <td className="px-4 py-3 font-medium">{device.hostname || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{device.serialNumber || '—'}</td>
                    <td className="px-4 py-3">{device.loggedInUser || '—'}</td>
                    <td className="px-4 py-3">
                      {device.employeeName ? (
                        <div>
                          <div>{device.employeeName}</div>
                          {device.employeeCode && (
                            <div className="text-xs text-navy-500">{device.employeeCode}</div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">{device.branchName || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{device.localIp || '—'}</td>
                    <td className="px-4 py-3" title={formatDateTime(device.lastHeartbeatAt)}>
                      {formatRelativeTime(device.lastHeartbeatAt)}
                      {liveTick >= 0 && device.productId && (
                        <div className="mt-0.5 text-xs text-navy-400">
                          <Link to={`/admin/items/${device.productId}`} className="hover:text-cyan-700">
                            View asset
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
