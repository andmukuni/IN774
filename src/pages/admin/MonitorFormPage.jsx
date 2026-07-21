import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, FormField, LoadingButton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const EMPTY_FORM = {
  name: '',
  type: 'http',
  hostOrUrl: '',
  port: '',
  expectedStatus: '',
  intervalSeconds: 300,
  timeoutMs: 8000,
  enabled: true,
  allowPrivateNetwork: false,
  dbName: '',
  dbUser: '',
  dbPassword: '',
  notifyEmail: '',
};

export default function MonitorFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dbPasswordConfigured, setDbPasswordConfigured] = useState(false);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/monitor/${id}`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to load target');
        const target = json.data?.target || json.data;
        if (!cancelled) {
          setForm({
            name: target.name || '',
            type: target.type || 'http',
            hostOrUrl: target.hostOrUrl || '',
            port: target.port ?? '',
            expectedStatus: target.expectedStatus ?? '',
            intervalSeconds: target.intervalSeconds ?? 300,
            timeoutMs: target.timeoutMs ?? 8000,
            enabled: target.enabled !== false,
            allowPrivateNetwork: Boolean(target.allowPrivateNetwork),
            dbName: target.dbName || '',
            dbUser: target.dbUser || '',
            dbPassword: '',
            notifyEmail: target.notifyEmail || '',
          });
          setDbPasswordConfigured(Boolean(target.dbPasswordConfigured));
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to load target.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, toast]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        port: form.port === '' ? undefined : Number(form.port),
        expectedStatus: form.expectedStatus === '' ? undefined : Number(form.expectedStatus),
        intervalSeconds: Number(form.intervalSeconds),
        timeoutMs: Number(form.timeoutMs),
      };
      if (isEdit && !payload.dbPassword) {
        delete payload.dbPassword;
      }
      const res = await fetch(`${API_BASE}/admin/monitor${isEdit ? `/${id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to save target');
      toast.success(isEdit ? 'Target updated.' : 'Target created.');
      navigate(isEdit ? `/admin/monitor/${id}` : '/admin/monitor');
    } catch (err) {
      toast.error(err?.message || 'Unable to save target.');
    } finally {
      setSaving(false);
    }
  };

  const showMysqlFields = form.type === 'mysql';
  const showTcpPort = form.type === 'tcp' || form.type === 'mysql';
  const showHttpFields = form.type === 'http';

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit monitor target' : 'Add monitor target'}
        subtitle="Register a URL, server, or database to check on a schedule"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Monitor', to: '/admin/monitor' },
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card title="Target details" className="max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Name"
                name="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                placeholder="Production API"
              />
              <FormField
                label="Type"
                name="type"
                type="select"
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
                options={[
                  { value: 'http', label: 'HTTP / HTTPS URL' },
                  { value: 'tcp', label: 'TCP host / IP' },
                  { value: 'mysql', label: 'MySQL database' },
                ]}
              />
              <div className="sm:col-span-2">
                <FormField
                  label={showHttpFields ? 'URL' : 'Host or IP'}
                  name="hostOrUrl"
                  value={form.hostOrUrl}
                  onChange={(e) => update('hostOrUrl', e.target.value)}
                  required
                  placeholder={showHttpFields ? 'https://example.com/health' : '192.168.1.10'}
                />
              </div>
              {showTcpPort && (
                <FormField
                  label="Port"
                  name="port"
                  type="number"
                  value={form.port}
                  onChange={(e) => update('port', e.target.value)}
                  required
                  placeholder={form.type === 'mysql' ? '3306' : '443'}
                />
              )}
              {showHttpFields && (
                <FormField
                  label="Expected HTTP status (optional)"
                  name="expectedStatus"
                  type="number"
                  value={form.expectedStatus}
                  onChange={(e) => update('expectedStatus', e.target.value)}
                  placeholder="200"
                />
              )}
              {showMysqlFields && (
                <>
                  <FormField
                    label="Database name"
                    name="dbName"
                    value={form.dbName}
                    onChange={(e) => update('dbName', e.target.value)}
                    required
                  />
                  <FormField
                    label="Database user"
                    name="dbUser"
                    value={form.dbUser}
                    onChange={(e) => update('dbUser', e.target.value)}
                    required
                  />
                  <div className="sm:col-span-2">
                    <FormField
                      label={isEdit ? 'Database password (leave blank to keep)' : 'Database password'}
                      name="dbPassword"
                      type="password"
                      value={form.dbPassword}
                      onChange={(e) => update('dbPassword', e.target.value)}
                      required={!isEdit}
                      placeholder={isEdit && dbPasswordConfigured ? '••••••••' : ''}
                    />
                  </div>
                </>
              )}
              <FormField
                label="Check interval (seconds)"
                name="intervalSeconds"
                type="number"
                value={form.intervalSeconds}
                onChange={(e) => update('intervalSeconds', e.target.value)}
                required
              />
              <FormField
                label="Timeout (ms)"
                name="timeoutMs"
                type="number"
                value={form.timeoutMs}
                onChange={(e) => update('timeoutMs', e.target.value)}
                required
              />
              <div className="sm:col-span-2">
                <FormField
                  label="Alert email (optional)"
                  name="notifyEmail"
                  type="email"
                  value={form.notifyEmail}
                  onChange={(e) => update('notifyEmail', e.target.value)}
                  placeholder="ops@example.com"
                />
              </div>
              <FormField
                label="Enabled"
                name="enabled"
                type="select"
                value={form.enabled ? '1' : '0'}
                onChange={(e) => update('enabled', e.target.value === '1')}
                options={[
                  { value: '1', label: 'Yes' },
                  { value: '0', label: 'No' },
                ]}
              />
              <FormField
                label="Allow private network"
                name="allowPrivateNetwork"
                type="select"
                value={form.allowPrivateNetwork ? '1' : '0'}
                onChange={(e) => update('allowPrivateNetwork', e.target.value === '1')}
                options={[
                  { value: '0', label: 'No (recommended)' },
                  { value: '1', label: 'Yes — LAN/private hosts' },
                ]}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <LoadingButton type="submit" loading={saving} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium">
                {isEdit ? 'Save changes' : 'Create target'}
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/admin/monitor/${id}` : '/admin/monitor')}
                className="px-4 py-2 rounded-xl border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                Cancel
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
