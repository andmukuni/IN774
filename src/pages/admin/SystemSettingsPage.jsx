import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users } from 'lucide-react';
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
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

export default function SystemSettingsPage() {
  const toast = useToast();
  const { setCompany } = useCompany();
  const { hasPermission } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = hasPermission('settings.manage');

  const intakeUrl = useMemo(
    () => `${window.location.origin}/intake`,
    [],
  );

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
      toast('System settings saved.', { type: 'success' });
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
        subtitle="Health, architecture, inventory overview, and application configuration"
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
        <>
          <SystemHealthCards health={overview.health} />

          <Card title="Architecture & network" subtitle="How the inventory system is connected">
            <SystemArchitectureDiagram architecture={overview.architecture} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Card title="Configuration" subtitle="Organization and public intake">
              <SystemSettingsForm
                settings={overview.settings}
                intakeUrl={intakeUrl}
                onSave={handleSave}
                saving={saving}
                canSave={canSave}
              />
            </Card>

            <div className="space-y-6">
              <Card title="Inventory & catalog" subtitle="Current system totals">
                <SystemCatalogStats counts={overview.counts} inventory={overview.inventory} />
              </Card>

              <Card title="Security & access" subtitle="Administration shortcuts">
                <div className="grid gap-3 sm:grid-cols-2">
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
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Appearance" subtitle="Admin interface theme">
              <p className="text-sm text-navy-500 mb-4">
                Choose light or dark mode for the admin panel.
              </p>
              <ThemeToggle variant="segmented" />
            </Card>

            <Card title="Environment" subtitle="Read-only deployment info">
              <dl className="space-y-3 text-sm">
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
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
