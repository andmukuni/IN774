import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, RefreshCw, Search } from 'lucide-react';
import { PageHeader, Card, Spinner, LoadingButton } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePresenceStream } from '../../hooks/usePresenceStream';
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

function formatDuration(value) {
  if (!value) return '—';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
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

function LivePill({ connected }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        connected
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      {connected ? 'SSE live' : 'SSE reconnecting'}
    </span>
  );
}

function deviceRowHref(device) {
  if (device?.productId) return `/admin/items/${device.productId}`;
  if (device?.employeeId) return `/admin/employees/${device.employeeId}`;
  return null;
}

export default function PresenceListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canView = hasPermission('presence.view');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [liveTick, setLiveTick] = useState(0);

  const applySnapshot = useCallback((nextDevices, payload) => {
    const list = Array.isArray(nextDevices) ? nextDevices : [];
    setAllDevices(list);
    if (payload?.summary) {
      setSummary(payload.summary);
    } else {
      setSummary({
        total: list.length,
        online: list.filter((d) => d.onlineStatus === 'online').length,
        offline: list.filter((d) => d.onlineStatus === 'offline').length,
      });
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadDevices = useCallback(async (silent = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/admin/presence?limit=200`, {
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

      applySnapshot(listJson.data, {
        summary: summaryRes.ok && summaryJson?.ok
          ? summaryJson.data
          : undefined,
      });
    } catch (err) {
      toast.error(err?.message || 'Unable to load PC presence data.');
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, toast, applySnapshot]);

  const { connected } = usePresenceStream({
    enabled: canView,
    onSnapshot: applySnapshot,
  });

  useEffect(() => {
    // Initial REST load in case SSE is slow/unavailable.
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const interval = setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    let next = allDevices;
    if (statusFilter === 'online' || statusFilter === 'offline') {
      next = next.filter((d) => d.onlineStatus === statusFilter);
    }
    if (term) {
      next = next.filter((d) => {
        const hay = [
          d.hostname,
          d.serialNumber,
          d.loggedInUser,
          d.localIp,
          d.employeeName,
          d.employeeCode,
          d.branchName,
          d.productName,
          d.productSku,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
    }
    setDevices(next);
  }, [allDevices, statusFilter, search]);

  const filteredSummary = useMemo(() => {
    if (!statusFilter && !search.trim()) return summary;
    return {
      total: devices.length,
      online: devices.filter((d) => d.onlineStatus === 'online').length,
      offline: devices.filter((d) => d.onlineStatus === 'offline').length,
    };
  }, [devices, statusFilter, search, summary]);

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
        subtitle="Live PC presence — online/offline updates without refreshing."
        actions={(
          <div className="flex items-center gap-2">
            <LivePill connected={connected} />
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
          </div>
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
                  <th className="px-4 py-3">Duration</th>
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
                {devices.map((device) => {
                  const since = device.statusChangedAt || device.durationSince;
                  const durationLabel = device.onlineStatus === 'online'
                    ? `Online ${formatDuration(since)}`
                    : `Offline ${formatDuration(since)}`;
                  const href = deviceRowHref(device);
                  return (
                    <tr
                      key={device.id}
                      className={`text-sm text-navy-800 transition-colors ${
                        href
                          ? 'cursor-pointer hover:bg-cyan-50/70'
                          : 'hover:bg-navy-50/60'
                      }`}
                      onClick={href ? () => navigate(href) : undefined}
                      onKeyDown={href ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(href);
                        }
                      } : undefined}
                      role={href ? 'link' : undefined}
                      tabIndex={href ? 0 : undefined}
                      title={href ? 'Open linked record' : undefined}
                    >
                      <td className="px-4 py-3">
                        <StatusBadge status={device.onlineStatus} />
                      </td>
                      <td className="px-4 py-3 tabular-nums" title={formatDateTime(since)}>
                        <span className={device.onlineStatus === 'online' ? 'text-emerald-700' : 'text-red-700'}>
                          {durationLabel}
                        </span>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
