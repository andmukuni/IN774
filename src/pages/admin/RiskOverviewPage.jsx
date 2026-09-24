import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Card, LoadingButton, PageHeader, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const BAND_CLASS = {
  low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  moderate: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
  unknown: 'bg-navy-50 text-navy-700 border-navy-200',
};

const SEVERITY_CLASS = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-900',
  low: 'bg-navy-100 text-navy-700',
};

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ScoreMeter({ label, score }) {
  const width = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-navy-800">{label}</span>
        <span className="tabular-nums text-navy-500">{score == null ? '—' : `${score}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-navy-100">
        <div className="h-full rounded-full bg-cyan-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function RiskOverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const canView = hasPermission('risk.view');
  const canManage = hasPermission('risk.manage');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [overview, setOverview] = useState(null);
  const [updatingId, setUpdatingId] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/risk/overview`, {
        headers: getAdminAuthHeaders(),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not load the assessment.');
      setOverview(body.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function startAssessment() {
    setStarting(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/risk/assessments`, {
        method: 'POST',
        headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Self-assessment ${new Date().toLocaleDateString()}`,
          assessorName: user?.name || '',
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not start the assessment.');
      navigate(`/admin/risk/assessments/${body.data.assessment.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStarting(false);
    }
  }

  async function setFindingStatus(id, status) {
    setUpdatingId(id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/risk/findings/${id}`, {
        method: 'PATCH',
        headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not update the finding.');
      await load(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId('');
    }
  }

  if (!canView) {
    return (
      <PageHeader
        title="Cyber risk assessment"
        subtitle="You do not have permission to view this assessment."
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Cyber risk' }]}
      />
    );
  }

  const band = overview?.band || { key: 'unknown', label: 'Not assessed' };
  const signals = overview?.signals;

  return (
    <div>
      <PageHeader
        title="Cyber risk assessment"
        subtitle="Score your own controls, then blend that with live server and device checks."
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Cyber risk' }]}
        actions={(
          <div className="flex items-center gap-2">
            <LoadingButton
              loading={refreshing}
              icon={RefreshCw}
              onClick={() => load(true)}
              className="rounded-xl border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700"
            >
              Refresh
            </LoadingButton>
            {canManage && (
              <LoadingButton
                loading={starting}
                icon={PlusCircle}
                onClick={startAssessment}
                className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                Start assessment
              </LoadingButton>
            )}
          </div>
        )}
      />

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className={`rounded-2xl border p-5 ${BAND_CLASS[band.key] || BAND_CLASS.unknown}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert size={16} />
                Residual risk
              </div>
              <p className="mt-2 text-3xl font-bold">{band.label}</p>
              <p className="mt-1 text-sm opacity-80">
                Score {overview?.overallScore ?? '—'}
                {overview?.basis === 'infrastructure' ? ' · questionnaire not scored yet' : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5">
              <p className="text-sm font-medium text-navy-500">Control score</p>
              <p className="mt-2 text-3xl font-bold text-navy-900">{overview?.controlScore ?? '—'}</p>
              <p className="mt-1 text-sm text-navy-400">{overview?.coveragePct ?? 0}% of controls answered</p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5">
              <p className="text-sm font-medium text-navy-500">Infrastructure score</p>
              <p className="mt-2 text-3xl font-bold text-navy-900">{overview?.infrastructureScore ?? '—'}</p>
              <p className="mt-1 text-sm text-navy-400">
                {signals?.monitors?.down || 0} down · {signals?.openIncidents || 0} open incidents
              </p>
            </div>
            <div className="rounded-2xl border border-navy-100 bg-white p-5">
              <p className="text-sm font-medium text-navy-500">Open findings</p>
              <p className="mt-2 text-3xl font-bold text-navy-900">
                {(overview?.findingCounts?.open || 0) + (overview?.findingCounts?.inProgress || 0)}
              </p>
              <p className="mt-1 text-sm text-navy-400">
                {overview?.findingCounts?.accepted || 0} accepted · {overview?.findingCounts?.resolved || 0} resolved
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Control domains" subtitle="Weighted from the latest assessment answers.">
              <div className="space-y-3">
                {(overview?.functions || []).map((fn) => (
                  <ScoreMeter key={fn.key} label={fn.label} score={fn.score} />
                ))}
              </div>
            </Card>

            <Card title="Live infrastructure" subtitle="Taken from Servers & DB Monitor and Devices Online.">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-navy-50 p-3">
                  <dt className="text-navy-500">Monitors up</dt>
                  <dd className="text-lg font-semibold text-navy-900">
                    {signals?.monitors?.up || 0} / {signals?.monitors?.enabled || 0}
                  </dd>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <dt className="text-navy-500">Unknown checks</dt>
                  <dd className="text-lg font-semibold text-navy-900">{signals?.monitors?.unknown || 0}</dd>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <dt className="text-navy-500">Devices online</dt>
                  <dd className="text-lg font-semibold text-navy-900">
                    {signals?.devices?.online || 0} / {signals?.devices?.total || 0}
                  </dd>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <dt className="text-navy-500">Devices offline</dt>
                  <dd className="text-lg font-semibold text-navy-900">{signals?.devices?.offline || 0}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-navy-400">
                The overall score is 70% questionnaire and 30% these live checks. Until an assessment is answered, only the live checks count.
              </p>
            </Card>
          </div>

          <Card title="Open findings" subtitle="Gaps from the questionnaire and from current monitor and device state." noPadding>
            <div className="divide-y divide-navy-100">
              {(overview?.findings || []).length === 0 && (
                <p className="px-6 py-8 text-sm text-navy-400">No open findings. Start an assessment to record control gaps.</p>
              )}
              {(overview?.findings || []).map((finding) => (
                <div key={finding.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY_CLASS[finding.severity] || SEVERITY_CLASS.low}`}>
                          {finding.severity}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-navy-400">{finding.source}</span>
                      </div>
                      <p className="mt-1 font-medium text-navy-900">{finding.title}</p>
                      <p className="mt-1 text-sm text-navy-500">{finding.recommendation}</p>
                    </div>
                    {canManage ? (
                      <select
                        className="rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                        value={finding.status}
                        disabled={updatingId === finding.id}
                        onChange={(event) => setFindingStatus(finding.id, event.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="accepted">Accepted</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    ) : (
                      <span className="text-xs font-medium uppercase text-navy-400">{finding.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Assessments" subtitle="Drafts stay editable. Completing one snapshots the control score." noPadding>
            <div className="divide-y divide-navy-100">
              {(overview?.assessments || []).length === 0 && (
                <p className="px-6 py-8 text-sm text-navy-400">No assessments yet.</p>
              )}
              {(overview?.assessments || []).map((item) => (
                <Link
                  key={item.id}
                  to={`/admin/risk/assessments/${item.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-navy-50"
                >
                  <div>
                    <p className="font-medium text-navy-900">{item.title}</p>
                    <p className="text-xs text-navy-400">
                      {item.assessorName || 'Unassigned'} · {item.status} · {formatWhen(item.updatedAt)}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-navy-600">
                    {item.controlScore == null ? '—' : item.controlScore}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
