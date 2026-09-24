import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const BAND_CLASS = {
  low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  moderate: 'text-cyan-800 bg-cyan-50 border-cyan-200',
  high: 'text-amber-900 bg-amber-50 border-amber-200',
  critical: 'text-red-800 bg-red-50 border-red-200',
  unknown: 'text-navy-700 bg-navy-50 border-navy-200',
};

export default function RiskPostureCard() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('risk.view');
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    if (!canView) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/risk/overview`, {
          headers: getAdminAuthHeaders(),
        });
        const body = await response.json();
        if (!cancelled && response.ok && body.ok) setOverview(body.data);
      } catch {
        // The dashboard still works if the risk summary cannot load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  if (!canView || !overview) return null;

  const band = overview.band || { key: 'unknown', label: 'Not assessed' };

  return (
    <Link
      to="/admin/risk"
      className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-navy-100 bg-white px-5 py-4 shadow-sm hover:border-cyan-200"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <ShieldAlert size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-navy-900">Cybersecurity self-assessment</span>
          <span className="block truncate text-xs text-navy-400">
            Control {overview.controlScore ?? '—'} · Infrastructure {overview.infrastructureScore ?? '—'} · {overview.coveragePct ?? 0}% answered
          </span>
        </span>
      </span>
      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase ${BAND_CLASS[band.key] || BAND_CLASS.unknown}`}>
        {band.label} · {overview.overallScore ?? '—'}
      </span>
    </Link>
  );
}
