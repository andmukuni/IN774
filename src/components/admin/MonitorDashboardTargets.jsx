import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Eye } from 'lucide-react';
import { Card, Spinner } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useMonitorStream } from '../../hooks/useMonitorStream';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();
const ROW_LIMIT = 4;

function secondsSince(value) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 1000));
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

function LatencySparkline({ samples = [], width = 80, height = 28, animateKey = 0 }) {
  const points = (samples || []).filter((v) => Number.isFinite(v));
  if (points.length < 2) {
    return (
      <span className="inline-block h-7 w-20 animate-pulse rounded bg-gradient-to-r from-navy-50 via-cyan-100/50 to-navy-50" aria-hidden />
    );
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const plotted = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return { x, y };
  });
  const coords = plotted.map((p) => `${p.x},${p.y}`).join(' ');
  const last = plotted[plotted.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 text-cyan-600" aria-hidden>
      <polyline
        key={`line-${animateKey}-${coords}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
        className="monitor-sparkline-line"
      />
      <circle cx={last.x} cy={last.y} r="2.75" className="fill-cyan-500 monitor-live-dot" />
    </svg>
  );
}

function LiveMsCell({
  latencyMs,
  avgLatencyMs,
  recentLatencies = [],
  trend = 'flat',
  lastCheckedAt,
  intervalSeconds = 300,
  liveTick = 0,
  pollGeneration = 0,
  streamConnected = false,
}) {
  const displayMs = latencyMs ?? avgLatencyMs;
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendClass = trend === 'up'
    ? 'text-amber-600'
    : trend === 'down'
      ? 'text-emerald-600'
      : 'text-navy-400';

  const ageSec = secondsSince(lastCheckedAt);
  const nextCheckSec = ageSec == null
    ? null
    : Math.max(0, (intervalSeconds || 300) - ageSec);

  return (
    <div className="flex items-center gap-2 min-w-[138px]">
      <LatencySparkline samples={recentLatencies} animateKey={pollGeneration} />
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums text-navy-900">
            {displayMs != null ? displayMs : '—'}
          </span>
          {displayMs != null && <span className="text-[10px] text-navy-400">ms</span>}
          <span className={`text-[10px] font-bold ${trendClass}`} title="Latest trend">{trendSymbol}</span>
        </div>
        {avgLatencyMs != null && displayMs != null && (
          <p className="text-[10px] tabular-nums text-navy-400">avg {avgLatencyMs} ms</p>
        )}
        <p className="text-[10px] tabular-nums text-cyan-700/80" key={liveTick}>
          {ageSec != null ? `${ageSec}s ago` : 'waiting…'}
          {nextCheckSec != null && nextCheckSec > 0 && (
            <span className="text-navy-400">{` · next ${nextCheckSec}s`}</span>
          )}
          {!streamConnected && (
            <span className="text-amber-600"> · reconnecting</span>
          )}
        </p>
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

export default function MonitorDashboardTargets() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('monitor.view');
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [streamGeneration, setStreamGeneration] = useState(0);
  const targetsRef = useRef([]);

  const applyTargets = useCallback((next) => {
    setTargets(next);
    targetsRef.current = next;
    setLoaded(true);
    setStreamGeneration((g) => g + 1);
  }, []);

  const loadTargets = useCallback(async () => {
    if (!canView) return;
    try {
      const res = await fetch(`${API_BASE}/admin/monitor`, {
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        applyTargets(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setLoaded(true);
    }
  }, [canView, applyTargets]);

  const { connected: streamConnected, error: streamError } = useMonitorStream({
    enabled: canView,
    onSnapshot: (next) => applyTargets(next),
  });

  useEffect(() => {
    if (!canView) return;
    loadTargets();
  }, [canView, loadTargets]);

  useEffect(() => {
    if (streamError && !streamConnected && !targetsRef.current.length) {
      loadTargets();
    }
  }, [streamError, streamConnected, loadTargets]);

  useEffect(() => {
    const interval = setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!canView) return null;

  const visibleTargets = targets.slice(0, ROW_LIMIT);

  return (
    <Card
      title="Monitored targets"
      subtitle={streamConnected ? 'Live updates via server stream' : 'Connecting to live monitor stream…'}
      noPadding
      className="mb-6"
      actions={(
        <Link
          to="/admin/monitor"
          className="text-xs font-medium text-cyan-600 hover:text-cyan-500"
        >
          View all
        </Link>
      )}
    >
      {!loaded ? (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      ) : visibleTargets.length === 0 ? (
        <div className="p-8 text-center">
          <Activity className="mx-auto mb-3 text-navy-300" size={32} />
          <p className="text-sm text-navy-600">No targets configured yet.</p>
          <Link
            to="/admin/monitor"
            className="mt-3 inline-block text-sm font-medium text-cyan-600 hover:text-cyan-500"
          >
            Open monitor
          </Link>
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
                <th className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      {streamConnected ? (
                        <>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                        </>
                      ) : (
                        <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      )}
                    </span>
                    Live (ms)
                  </span>
                </th>
                <th className="px-4 py-3 font-semibold">Speed / traffic</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {visibleTargets.map((target) => (
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
                      lastCheckedAt={target.lastCheckedAt}
                      intervalSeconds={target.intervalSeconds}
                      liveTick={liveTick}
                      pollGeneration={streamGeneration}
                      streamConnected={streamConnected}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SpeedTrafficCell speed={target.speed} traffic={target.traffic} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
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
  );
}
