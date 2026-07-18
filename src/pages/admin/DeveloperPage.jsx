import { useCallback, useEffect, useMemo, useState } from 'react';
import { Code2, Copy, Download, KeyRound, PlusCircle, Trash2 } from 'lucide-react';
import {
  PageHeader,
  Card,
  Spinner,
  ConfirmDialog,
  LoadingButton,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { EXTERNAL_API_SCOPES } from '../../../shared/externalApiScopes.js';
import {
  buildExternalApiPostmanCollection,
  buildExternalApiPostmanEnvironment,
} from '../../../shared/postmanExternalApi.js';
import { downloadJsonFile } from '../../utils/jsonDownload';

const API_BASE = getApiBase();

const EMPTY_FORM = {
  name: '',
  ipWhitelist: '',
  scopes: EXTERNAL_API_SCOPES.map((s) => s.key),
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DeveloperPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canView = hasPermission('developer.view');
  const canManage = hasPermission('developer.manage');

  const [keysLoading, setKeysLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [createdKey, setCreatedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const apiBaseUrl = useMemo(() => {
    if (meta?.apiBaseUrl) return meta.apiBaseUrl;
    if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
    return '/api/v1';
  }, [meta]);

  const loadData = useCallback(async () => {
    if (!canView) {
      setKeysLoading(false);
      return;
    }

    setKeysLoading(true);
    setLoadError('');
    try {
      const headers = getAdminAuthHeaders();
      const [metaRes, keysRes] = await Promise.all([
        fetch(`${API_BASE}/admin/developer/meta`, { headers, cache: 'no-store' }),
        fetch(`${API_BASE}/admin/developer/api-keys`, { headers, cache: 'no-store' }),
      ]);
      const [metaJson, keysJson] = await Promise.all([
        metaRes.json().catch(() => ({})),
        keysRes.json().catch(() => ({})),
      ]);
      if (!metaRes.ok || !metaJson?.ok) throw new Error(metaJson?.message || 'Failed to load developer metadata');
      if (!keysRes.ok || !keysJson?.ok) throw new Error(keysJson?.message || 'Failed to load API keys');
      setMeta(metaJson.data);
      setKeys(Array.isArray(keysJson.data) ? keysJson.data : []);
    } catch (err) {
      const message = err?.message || 'Unable to load developer settings.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setKeysLoading(false);
    }
  }, [canView, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleScope = (scopeKey) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scopeKey)
        ? prev.scopes.filter((s) => s !== scopeKey)
        : [...prev.scopes, scopeKey],
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const ipWhitelist = String(form.ipWhitelist || '')
        .split(/[\n,]+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const res = await fetch(`${API_BASE}/admin/developer/api-keys`, {
        method: 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          scopes: form.scopes,
          ipWhitelist,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to create API key');
      setCreatedKey(json.data);
      setForm(EMPTY_FORM);
      await loadData();
      toast.success('API key created.');
    } catch (err) {
      toast.error(err?.message || 'Unable to create API key.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (key) => {
    if (!canManage) return;
    try {
      const nextStatus = key.status === 'active' ? 'inactive' : 'active';
      const res = await fetch(`${API_BASE}/admin/developer/api-keys/${key.id}`, {
        method: 'PUT',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to update API key');
      await loadData();
      toast.success(nextStatus === 'active' ? 'API key activated.' : 'API key deactivated.');
    } catch (err) {
      toast.error(err?.message || 'Unable to update API key.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id || !canManage) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/developer/api-keys/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to delete API key');
      setDeleteTarget(null);
      await loadData();
      toast.success('API key deleted.');
    } catch (err) {
      toast.error(err?.message || 'Unable to delete API key.');
    } finally {
      setDeleting(false);
    }
  };

  const copyText = async (text, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error('Unable to copy to clipboard.');
    }
  };

  const exampleCurl = `curl -s "${apiBaseUrl}/assets?limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const downloadPostmanCollection = () => {
    downloadJsonFile(
      'gfl-inventory-external-api.postman_collection.json',
      buildExternalApiPostmanCollection(apiBaseUrl),
    );
    toast.success('Postman collection downloaded.');
  };

  const downloadPostmanEnvironment = () => {
    downloadJsonFile(
      'gfl-inventory-external-api.postman_environment.json',
      buildExternalApiPostmanEnvironment(apiBaseUrl),
    );
    toast.success('Postman environment downloaded.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        subtitle="External API credentials, server whitelisting, and integration docs"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Developer' },
        ]}
      />

      {!canView ? (
        <Card title="Access denied">
          <p className="text-sm text-navy-600">
            You do not have permission to view developer tools. Ask an administrator to grant
            {' '}
            <code className="rounded bg-navy-50 px-1.5 py-0.5">developer.view</code>
            {' '}
            in Access Control.
          </p>
        </Card>
      ) : (
        <>
          {loadError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {loadError}
            </div>
          )}

          <Card title="External API" subtitle="Share read-only inventory data with other systems">
            <div className="space-y-4 text-sm text-navy-700">
              <p>
                Base URL: <code className="rounded bg-navy-50 px-2 py-1 text-navy-900">{apiBaseUrl}</code>
                <button
                  type="button"
                  onClick={() => copyText(apiBaseUrl, 'Base URL copied')}
                  className="ml-2 inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-600"
                >
                  <Copy size={14} /> Copy
                </button>
              </p>

              <div>
                <p className="font-medium text-navy-900 mb-2">Authentication</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><code>Authorization: Bearer &lt;api-key&gt;</code></li>
                  <li><code>X-Api-Key: &lt;api-key&gt;</code></li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-navy-900 mb-2">Server whitelisting</p>
                <p>
                  Each API key must include one or more allowed server IPs or CIDR ranges
                  (for example <code>203.0.113.10</code> or <code>198.51.100.0/24</code>).
                  Requests from other IPs are rejected.
                </p>
              </div>

              <div>
                <p className="font-medium text-navy-900 mb-2">Endpoints</p>
                <div className="overflow-x-auto rounded-xl border border-navy-100">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-navy-50 text-navy-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Method</th>
                        <th className="px-4 py-2 font-medium">Path</th>
                        <th className="px-4 py-2 font-medium">Scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/health</td><td className="px-4 py-2">Public</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/assets</td><td className="px-4 py-2">assets.read</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/assets/:id</td><td className="px-4 py-2">assets.read</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/employees</td><td className="px-4 py-2">employees.read</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/employees/:id</td><td className="px-4 py-2">employees.read</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/employees/:id/assets</td><td className="px-4 py-2">employees.read</td></tr>
                      <tr><td className="px-4 py-2">GET</td><td className="px-4 py-2">/assignments</td><td className="px-4 py-2">assignments.read</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-medium text-navy-900 mb-2">Example</p>
                <pre className="overflow-x-auto rounded-xl bg-navy-900 p-4 text-xs text-cyan-100">{exampleCurl}</pre>
              </div>

              <div>
                <p className="font-medium text-navy-900 mb-2">Postman</p>
                <p className="mb-3">
                  Import these files into Postman to test all external API endpoints. Set your API key in the
                  environment after importing.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadPostmanCollection}
                    className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
                  >
                    <Download size={16} />
                    Download collection
                  </button>
                  <button
                    type="button"
                    onClick={downloadPostmanEnvironment}
                    className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
                  >
                    <Download size={16} />
                    Download environment
                  </button>
                </div>
              </div>

              <div>
                <p className="font-medium text-navy-900 mb-2">Asset ↔ employee link</p>
                <p>
                  Assets include an <code>employee</code> object when assigned.
                  Use <code>/assignments</code> for a flat asset-to-employee list, or
                  <code>/employees/:id/assets</code> to fetch all assets for one employee.
                </p>
              </div>
            </div>
          </Card>

          <Card title="API keys" subtitle={canManage ? 'Create credentials for external systems' : 'View-only access'}>
            {keysLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size={32} className="text-cyan-600" />
              </div>
            ) : (
              <>
            {canManage && (
              <form onSubmit={handleCreate} className="mb-6 space-y-4 rounded-xl border border-navy-100 bg-navy-50/40 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-navy-700">Integration name</span>
                    <input
                      className="w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="HR system, asset tracker..."
                      required
                    />
                  </label>
                  <label className="block lg:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-navy-700">Allowed server IPs / CIDR</span>
                    <textarea
                      className="min-h-[96px] w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm"
                      value={form.ipWhitelist}
                      onChange={(e) => setForm((p) => ({ ...p, ipWhitelist: e.target.value }))}
                      placeholder={'203.0.113.10\n198.51.100.0/24'}
                      required
                    />
                    <span className="mt-1 block text-xs text-navy-500">One IP or CIDR per line. Required for every key.</span>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-navy-700">Scopes</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {EXTERNAL_API_SCOPES.map((scope) => (
                      <label key={scope.key} className="flex items-start gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={form.scopes.includes(scope.key)}
                          onChange={() => toggleScope(scope.key)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-navy-900">{scope.name}</span>
                          <span className="block text-xs text-navy-500">{scope.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <LoadingButton
                  type="submit"
                  loading={saving}
                  loadingLabel="Creating..."
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
                >
                  <PlusCircle size={16} />
                  Create API key
                </LoadingButton>
              </form>
            )}

            {keys.length === 0 ? (
              <p className="text-sm text-navy-500">No API keys yet.</p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => {
                  const scopes = Array.isArray(key.scopes) ? key.scopes : [];
                  const ipWhitelist = Array.isArray(key.ipWhitelist) ? key.ipWhitelist : [];
                  return (
                  <div key={key.id} className="rounded-xl border border-navy-100 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <KeyRound size={16} className="text-cyan-600" />
                          <p className="font-semibold text-navy-900">{key.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${key.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-navy-100 text-navy-600'}`}>
                            {key.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-navy-600">Key prefix: <code>{key.maskedKey}</code></p>
                        <p className="mt-1 text-xs text-navy-500">
                          Scopes: {scopes.join(', ') || '—'}
                        </p>
                        <p className="mt-1 text-xs text-navy-500">
                          Whitelist: {ipWhitelist.join(', ') || '—'}
                        </p>
                        <p className="mt-1 text-xs text-navy-500">
                          Last used: {formatDateTime(key.lastUsedAt)} · Created: {formatDateTime(key.createdAt)}
                        </p>
                      </div>

                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(key)}
                            className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
                          >
                            {key.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(key)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </Card>
        </>
      )}

      {createdKey?.apiKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 text-navy-900">
              <Code2 size={18} className="text-cyan-600" />
              <h3 className="text-lg font-semibold">Save this API key</h3>
            </div>
            <p className="mt-2 text-sm text-navy-600">
              This secret is shown only once. Copy it now and share it securely with the integrating system.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-navy-900 p-4 text-xs text-cyan-100">{createdKey.apiKey}</pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(createdKey.apiKey, 'API key copied')}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                <Copy size={16} />
                Copy key
              </button>
              <button
                type="button"
                onClick={() => setCreatedKey(null)}
                className="rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete API key"
        message={`Delete ${deleteTarget?.name || 'this API key'}? External systems using it will stop working immediately.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
