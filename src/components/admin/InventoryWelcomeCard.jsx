import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Boxes, CalendarDays, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { formatCurrency } from '../../utils/helpers';

const API_BASE = getApiBase();

const STATUS_META = {
  in_stock: { label: 'In Stock', color: '#34d399', to: '/admin/items' },
  low_stock: { label: 'Low Stock', color: '#fbbf24', to: '/admin/items?status=low_stock' },
  out_of_stock: { label: 'Out of Stock', color: '#fb7185', to: '/admin/items?status=out_of_stock' },
  discontinued: { label: 'Discontinued', color: '#94a3b8', to: '/admin/items' },
};
const STATUS_ORDER = ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'];

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name, email) {
  const n = String(name || '').trim();
  if (n) return n.split(/\s+/)[0];
  return String(email || '').split('@')[0] || 'there';
}

export default function InventoryWelcomeCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const now = useMemo(() => new Date(), []);
  const greeting = greetingFor(now.getHours());
  const fullDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to load analytics');
        setStats(json.data);
      } catch (err) {
        if (alive) setError(err?.message || 'Unable to load analytics.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const analytics = useMemo(() => {
    if (!stats) return null;
    const byStatus = stats.byStatus || {};
    const segments = STATUS_ORDER.map((key) => ({
      key,
      ...STATUS_META[key],
      count: Number(byStatus[key] || 0),
    }));
    const totalCount = segments.reduce((s, x) => s + x.count, 0);
    return {
      segments,
      totalCount,
      totalProducts: stats.totalProducts ?? 0,
      totalUnits: stats.totalUnits ?? 0,
      inventoryValue: stats.inventoryValue ?? 0,
      lowStockCount: stats.lowStockCount ?? 0,
    };
  }, [stats]);

  const kpis = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: 'Total products', value: analytics.totalProducts.toLocaleString(), icon: Package },
      { label: 'Units in stock', value: analytics.totalUnits.toLocaleString(), icon: Boxes },
      { label: 'Inventory value', value: formatCurrency(analytics.inventoryValue), icon: Wallet },
      { label: 'Low stock items', value: analytics.lowStockCount.toLocaleString(), icon: CalendarDays },
    ];
  }, [analytics]);

  const visibleSegments = (analytics?.segments || []).filter((s) => s.count > 0);
  const pct = (count) =>
    analytics && analytics.totalCount > 0 ? (count / analytics.totalCount) * 100 : 0;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-cyan-800 p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {greeting}, {firstName(user?.name, user?.email)}
          </h2>
          <p className="mt-0.5 text-sm text-cyan-100/80">
            Here&apos;s your inventory overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-cyan-100/90">
          <CalendarDays size={16} />
          <span className="text-sm font-medium">{fullDate}</span>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-rose-200">{error}</p>
      )}

      {!error && !analytics && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>
      )}

      {analytics && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5 text-cyan-100/70">
                  <Icon size={14} />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-1.5 text-lg font-bold leading-tight text-white">{value}</p>
              </div>
            ))}
          </div>

          {analytics.totalCount > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-cyan-100/70">
                  Stock status breakdown
                </span>
                <span className="text-xs text-cyan-100/60">
                  {analytics.totalCount.toLocaleString()} total
                </span>
              </div>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-white/10">
                {visibleSegments.map((seg) => (
                  <div
                    key={seg.key}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${pct(seg.count)}%`, minWidth: '4px', backgroundColor: seg.color }}
                    title={`${seg.label}: ${seg.count.toLocaleString()} (${pct(seg.count).toFixed(1)}%)`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {analytics.segments.map((seg) => (
                  <Link
                    key={seg.key}
                    to={seg.to}
                    className="group flex items-center gap-2 text-sm text-cyan-50/90 transition-opacity hover:opacity-80"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-medium group-hover:underline">{seg.label}</span>
                    <span className="text-cyan-100/60">
                      {seg.count.toLocaleString()} · {pct(seg.count).toFixed(0)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
