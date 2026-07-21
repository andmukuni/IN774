import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Gauge, Server, ServerOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMonitorStream } from '../../hooks/useMonitorStream';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import {
  availabilityKpiColor,
  computeMonitorKpis,
  performanceKpiColor,
  statusSummaryColor,
} from '../../utils/monitorKpi';

const API_BASE = getApiBase();

const COLOR_MAP = {
  cyan: 'bg-cyan-50 text-cyan-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-navy-50 text-navy-500',
};

function useAnimatedPercent(target) {
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target == null) return undefined;
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return undefined;
    }

    const start = performance.now();
    const duration = 700;
    let raf = 0;

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return target == null ? null : display;
}

function MonitorKpiCard({
  label,
  value,
  suffix = '',
  icon: Icon,
  color = 'cyan',
  subtitle,
  to,
  animationDelay = 0,
}) {
  const isPercent = suffix === '%' && typeof value === 'number';
  const animated = useAnimatedPercent(isPercent ? value : null);
  const displayValue = isPercent ? `${animated ?? value}${suffix}` : `${value ?? '—'}${suffix}`;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const content = (
    <div
      className={`app-card h-full min-h-28 bg-white rounded-xl border border-navy-100 p-3 hover:shadow-md transition-all duration-500 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          {Icon && (
            <div className={`p-1.5 rounded-lg ${COLOR_MAP[color] || COLOR_MAP.cyan}`}>
              <Icon size={16} />
            </div>
          )}
        </div>
        <div className="text-xl font-bold text-navy-900 tabular-nums">{displayValue}</div>
        <div className="text-xs text-navy-500 mt-0.5">{label}</div>
        {subtitle && (
          <div className="text-[11px] text-navy-400 mt-0.5 min-h-[1.75rem] line-clamp-2">{subtitle}</div>
        )}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block h-full">{content}</Link>;
  }

  return content;
}

export default function MonitorDashboardKpis() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('monitor.view');
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const targetsRef = useRef([]);

  const applyTargets = useCallback((next) => {
    setTargets(next);
    targetsRef.current = next;
    setLoaded(true);
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

  const kpis = useMemo(() => computeMonitorKpis(targets), [targets]);

  if (!canView) return null;

  let cardIndex = 0;
  const nextDelay = () => {
    const delay = cardIndex * 60;
    cardIndex += 1;
    return delay;
  };

  const availColor = availabilityKpiColor(kpis);
  const perfColor = performanceKpiColor(kpis.performancePercent);
  const onlineColor = statusSummaryColor(kpis);

  const streamLabel = streamConnected
    ? 'Live via server stream'
    : 'Connecting to live stream…';

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-400">
            Servers &amp; infrastructure
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-navy-400">
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
            {streamLabel}
          </span>
        </div>
        <Link
          to="/admin/monitor"
          className="text-xs font-medium text-cyan-600 hover:text-cyan-500"
        >
          Open monitor
        </Link>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-navy-100 bg-white p-3 min-h-28">
              <div className="h-10 w-10 bg-navy-100 rounded-lg mb-3" />
              <div className="h-7 bg-navy-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-navy-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : kpis.total === 0 ? (
        <div className="rounded-xl border border-navy-100 bg-white p-4 text-sm text-navy-600">
          No monitor targets configured yet.{' '}
          <Link to="/admin/monitor" className="font-medium text-cyan-600 hover:text-cyan-500">
            Set up servers &amp; DB monitor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MonitorKpiCard
            label="Availability"
            value={kpis.availabilityPercent}
            suffix="%"
            icon={Activity}
            color={availColor}
            subtitle={`${kpis.up} of ${kpis.total} servers online`}
            to="/admin/monitor"
            animationDelay={nextDelay()}
          />
          <MonitorKpiCard
            label="Performance"
            value={kpis.performancePercent ?? '—'}
            suffix={kpis.performancePercent != null ? '%' : ''}
            icon={Gauge}
            color={perfColor}
            subtitle="Latency-based score across targets"
            to="/admin/monitor"
            animationDelay={nextDelay()}
          />
          <MonitorKpiCard
            label="Servers online"
            value={kpis.up}
            icon={Server}
            color={onlineColor}
            subtitle={kpis.down > 0 ? `${kpis.down} down` : 'All monitored targets up'}
            to="/admin/monitor"
            animationDelay={nextDelay()}
          />
          <MonitorKpiCard
            label="Issues"
            value={kpis.down + kpis.unknown}
            icon={ServerOff}
            color={kpis.down + kpis.unknown > 0 ? 'red' : 'green'}
            subtitle={
              kpis.down + kpis.unknown === 0
                ? 'No issues detected'
                : kpis.unknown > 0
                  ? `${kpis.unknown} unknown · ${kpis.down} down`
                  : `${kpis.down} down`
            }
            to="/admin/monitor"
            animationDelay={nextDelay()}
          />
        </div>
      )}
    </section>
  );
}
