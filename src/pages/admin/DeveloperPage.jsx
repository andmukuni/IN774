import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Code2,
  Copy,
  Download,
  Globe,
  KeyRound,
  PlusCircle,
  Power,
  PowerOff,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  Spinner,
  ConfirmDialog,
  LoadingButton,
  Modal,
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
import ExternalApiDocumentation from '../../components/admin/ExternalApiDocumentation';

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

function SummaryTile({ icon: Icon, label, children }) {
  return (
    <div className="app-card rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600 shrink-0">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
          <div className="mt-1 text-sm text-navy-900">{children}</div>
        </div>
      </div>
    </div>
  );
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
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const apiBaseUrl = useMemo(() => {
    if (meta?.apiBaseUrl) return meta.apiBaseUrl;
    if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
    return '/api/v1';
  }, [meta]);

  const activeKeyCount = useMemo(
    () => keys.filter((key) => key.status === 'active').length,
    [keys],
  );

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
      setCreateOpen(false);
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

  const postmanActions = canView ? (
    <>
      <button
        type="button"
        onClick={downloadPostmanCollection}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
      >
        <Download size={14} />
        Collection
      </button>
      <button
        type="button"
        onClick={downloadPostmanEnvironment}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
      >
        <Download size={14} />
        Environment
      </button>
    </>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        subtitle="External API credentials, server whitelisting, and integration docs"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Developer' },
        ]}
        actions={postmanActions}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryTile icon={Globe} label="Base URL">
              <div className="flex items-center gap-2">
                <code className="truncate rounded bg-navy-50 px-2 py-1 text-xs text-navy-900">{apiBaseUrl}</code>
                <button
                  type="button"
                  onClick={() => copyText(apiBaseUrl, 'Base URL copied')}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-600"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
            </SummaryTile>

            <SummaryTile icon={Shield} label="Authentication">
              <div className="space-y-1 text-xs text-navy-600">
                <p><code>Authorization: Bearer &lt;api-key&gt;</code></p>
                <p><code>X-Api-Key: &lt;api-key&gt;</code></p>
              </div>
            </SummaryTile>

            <SummaryTile icon={KeyRound} label="API keys">
              {keysLoading ? (
                <span className="text-navy-400">Loading…</span>
              ) : (
                <p>
                  <span className="font-semibold">{activeKeyCount}</span>
                  <span className="text-navy-500"> active · </span>
                  <span className="font-semibold">{keys.length}</span>
                  <span className="text-navy-500"> total</span>
                </p>
              )}
            </SummaryTile>
          </div>

          <Card
            title="API keys"
            subtitle={canManage ? 'Create credentials for external systems' : 'View-only access'}
            actions={canManage ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
              >
                <PlusCircle size={14} />
                Create API key
              </button>
            ) : null}
          >
            {keysLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size={32} className="text-cyan-600" />
              </div>
            ) : keys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-10 text-center">
                <p className="text-sm text-navy-500">
                  Create a key to share inventory data with another system.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    <PlusCircle size={16} />
                    Create API key
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-navy-100">
                <table className="min-w-full divide-y divide-navy-100 text-sm">
                  <thead className="bg-navy-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-navy-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Prefix</th>
                      <th className="px-4 py-3">Scopes</th>
                      <th className="px-4 py-3">Whitelist</th>
                      <th className="px-4 py-3">Last used</th>
                      <th className="px-4 py-3">Created</th>
                      {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50 bg-white">
                    {keys.map((key) => {
                      const scopes = Array.isArray(key.scopes) ? key.scopes : [];
                      const ipWhitelist = Array.isArray(key.ipWhitelist) ? key.ipWhitelist : [];
                      return (
                        <tr key={key.id} className="text-navy-800 hover:bg-navy-50/60">
                          <td className="px-4 py-3">
                            <div className="flex min-w-[140px] items-center gap-2">
                              <KeyRound size={14} className="shrink-0 text-cyan-600" />
                              <span className="font-medium text-navy-900">{key.name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${key.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-navy-100 text-navy-600'}`}>
                              {key.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <code className="text-xs text-navy-700">{key.maskedKey}</code>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <span className="block truncate text-xs text-navy-600" title={scopes.join(', ') || '—'}>
                              {scopes.join(', ') || '—'}
                            </span>
                          </td>
                          <td className="max-w-[160px] px-4 py-3">
                            <span className="block truncate text-xs text-navy-600" title={ipWhitelist.join(', ') || '—'}>
                              {ipWhitelist.join(', ') || '—'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-600">
                            {formatDateTime(key.lastUsedAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-600">
                            {formatDateTime(key.createdAt)}
                          </td>
                          {canManage && (
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <div className="inline-flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(key)}
                                  title={key.status === 'active' ? 'Deactivate' : 'Activate'}
                                  aria-label={key.status === 'active' ? 'Deactivate' : 'Activate'}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
                                >
                                  {key.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(key)}
                                  title="Delete"
                                  aria-label="Delete"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="API documentation" subtitle="Endpoints, parameters, and response examples">
            <ExternalApiDocumentation
              baseUrl={apiBaseUrl}
              exampleCurl={exampleCurl}
              onCopy={copyText}
            />
          </Card>
        </>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
        }}
        title="Create new key"
        subtitle="Credentials for an external system"
        size="lg"
        footer={(
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              className="rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="create-api-key-form"
              loading={saving}
              loadingLabel="Creating..."
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              <PlusCircle size={16} />
              Create API key
            </LoadingButton>
          </>
        )}
      >
        <form id="create-api-key-form" onSubmit={handleCreate} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-700">Integration name</span>
            <input
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="HR system, asset tracker..."
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-700">Allowed server IPs / CIDR</span>
            <textarea
              className="min-h-[88px] w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm"
              value={form.ipWhitelist}
              onChange={(e) => setForm((p) => ({ ...p, ipWhitelist: e.target.value }))}
              placeholder={'*\n# or restrict:\n# 203.0.113.10\n# 198.51.100.0/24'}
            />
            <span className="mt-1 block text-xs text-navy-500">
              One IP or CIDR per line. Use <code>*</code> or leave blank to allow any IP (recommended for presence agents).
            </span>
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">Scopes</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        </form>
      </Modal>

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
