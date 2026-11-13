import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Mail,
  Monitor,
  Server,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import {
  Card,
  PageHeader,
  Spinner,
} from '../../components/ui';
import ThemeToggle from '../../components/ThemeToggle';
import SystemHealthCards from '../../components/admin/SystemHealthCards';
import SystemArchitectureDiagram from '../../components/admin/SystemArchitectureDiagram';
import SystemCatalogStats from '../../components/admin/SystemCatalogStats';
import SystemSettingsForm from '../../components/admin/SystemSettingsForm';
import SmtpSettingsForm from '../../components/admin/SmtpSettingsForm';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'smtp', label: 'SMTP', icon: Mail },
  { id: 'system', label: 'System', icon: Server },
];

function SettingsTabs({ activeTab, onChange }) {
  return (
    <div className="border-b border-navy-100">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Settings sections">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-cyan-600 text-cyan-700'
                  : 'border-transparent text-navy-500 hover:border-navy-200 hover:text-navy-800'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function SystemSettingsPage() {
  const toast = useToast();
  const { setCompany } = useCompany();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = hasPermission('settings.manage');
  const activeTab = TABS.some((tab) => tab.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const intakeUrl = useMemo(
    () => `${window.location.origin}/intake`,
    [],
  );

  const setActiveTab = useCallback((tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === 'overview') next.delete('tab');
      else next.set('tab', tabId);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to load system settings');
      }
      setOverview(json.data);
      if (json.data?.settings?.companyName) {
        setCompany({
          name: json.data.settings.companyName,
          description: json.data.settings.intakeIntroText,
        });
      }
    } catch (err) {
      setError(err?.message || 'Unable to load system settings.');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [setCompany]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to save settings');
      }
      setOverview(json.data);
      if (json.data?.settings?.companyName) {
        setCompany({
          name: json.data.settings.companyName,
          description: json.data.settings.intakeIntroText,
        });
      }
      toast('Settings saved.', { type: 'success' });
    } catch (err) {
      toast(err?.message || 'Could not save settings.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        subtitle="Health, configuration, email delivery, and deployment"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Settings' },
        ]}
      />

      {loading && (
        <Card>
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        </Card>
      )}

      {!loading && error && (
        <Card title="Unable to load settings">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && overview && (
        <Card noPadding>
          <div className="px-6 pt-4">
            <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <SystemHealthCards health={overview.health} />

                <div>
                  <h3 className="text-sm font-semibold text-navy-900">Architecture & network</h3>
                  <p className="mt-0.5 text-xs text-navy-400">How the inventory system is connected</p>
                  <div className="mt-4">
                    <SystemArchitectureDiagram architecture={overview.architecture} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-navy-900">Inventory & catalog</h3>
                  <p className="mt-0.5 text-xs text-navy-400">Current system totals</p>
                  <div className="mt-4">
                    <SystemCatalogStats counts={overview.counts} inventory={overview.inventory} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900">Organization & intake</h3>
                <p className="mt-0.5 text-xs text-navy-400">Company details and public branch equipment form</p>
                <div className="mt-4">
                  <SystemSettingsForm
                    settings={overview.settings}
                    intakeUrl={intakeUrl}
                    onSave={handleSave}
                    saving={saving}
                    canSave={canSave}
                  />
                </div>
              </div>
            )}

            {activeTab === 'smtp' && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900">Outbound email (SMTP)</h3>
                <p className="mt-0.5 text-xs text-navy-400">Configure how the system sends email notifications</p>
                <div className="mt-4">
                  <SmtpSettingsForm
                    settings={overview.settings}
                    onSave={handleSave}
                    saving={saving}
                    canSave={canSave}
                  />
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                    <Monitor size={16} className="text-cyan-600" />
                    Appearance
                  </h3>
                  <p className="mt-0.5 text-xs text-navy-400">Admin interface theme</p>
                  <div className="mt-4 rounded-xl border border-navy-100 p-4">
                    <p className="text-sm text-navy-500 mb-4">
                      Choose light or dark mode for the admin panel.
                    </p>
                    <ThemeToggle variant="segmented" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                    <Server size={16} className="text-cyan-600" />
                    Environment
                  </h3>
                  <p className="mt-0.5 text-xs text-navy-400">Read-only deployment info</p>
                  <dl className="mt-4 space-y-3 rounded-xl border border-navy-100 p-4 text-sm">
                    <div className="flex justify-between gap-4 border-b border-navy-50 pb-2">
                      <dt className="text-navy-500">Node environment</dt>
                      <dd className="font-medium text-navy-900">{overview.environment?.nodeEnv || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-navy-50 pb-2">
                      <dt className="text-navy-500">Database</dt>
                      <dd className="font-medium text-navy-900">{overview.environment?.dbName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-navy-50 pb-2">
                      <dt className="text-navy-500">App URL</dt>
                      <dd className="font-medium text-navy-900 truncate">{overview.environment?.appUrl || window.location.origin}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-navy-500">CORS origins</dt>
                      <dd className="font-medium text-navy-900">{overview.environment?.corsOriginCount ?? 0} configured</dd>
                    </div>
                  </dl>
                </div>

                <div className="lg:col-span-2">
                  <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                    <Shield size={16} className="text-cyan-600" />
                    Security & access
                  </h3>
                  <p className="mt-0.5 text-xs text-navy-400">Administration shortcuts</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      to="/admin/users"
                      className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/40 transition-colors"
                    >
                      <p className="font-medium text-navy-900 flex items-center gap-2">
                        <Users size={16} className="text-cyan-600" />
                        Users
                      </p>
                      <p className="mt-1 text-xs text-navy-500">Manage admin accounts</p>
                    </Link>
                    <Link
                      to="/admin/access-control"
                      className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/40 transition-colors"
                    >
                      <p className="font-medium text-navy-900 flex items-center gap-2">
                        <Shield size={16} className="text-cyan-600" />
                        Access control
                      </p>
                      <p className="mt-1 text-xs text-navy-500">Roles and permissions</p>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
