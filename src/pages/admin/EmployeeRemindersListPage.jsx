import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ListSearchFilters,
  emptySearchFilters,
  LoadingButton,
} from '../../components/ui';
import { dateHtml, textHtml } from '../../utils/datatableHelpers';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

function statusHtml(status) {
  const key = String(status || 'draft').toLowerCase();
  const labels = {
    draft: 'Draft',
    sending: 'Sending',
    completed: 'Completed',
    failed: 'Failed',
  };
  const badgeClass = key === 'completed' ? 'processed' : key === 'failed' ? 'cancelled' : key === 'sending' ? 'submitted' : 'draft';
  return `<span class="dt-badge dt-badge-${badgeClass}">${labels[key] || key}</span>`;
}

export default function EmployeeRemindersListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const loadBranches = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/branches?limit=100`, {
      headers: getAdminAuthHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) {
      setBranches(json.data || []);
    }
  }, []);

  const loadPreview = useCallback(async (nextBranchId = branchId) => {
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextBranchId) params.set('branchId', nextBranchId);
      const res = await fetch(`${API_BASE}/admin/reminders/preview?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Unable to preview recipients');
      }
      setPreview(json.data);
    } catch (err) {
      setPreview(null);
      toast(err?.message || 'Unable to preview recipients.', { type: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    loadBranches();
    loadPreview();
  }, [loadBranches, loadPreview]);

  const handleSend = async () => {
    if (!canManage) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reminders/sessions`, {
        method: 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName.trim() || undefined,
          branchId: branchId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to send reminders');
      }
      toast(`Reminder session sent to ${json.data?.sentCount ?? 0} employee(s).`, { type: 'success' });
      setSessionName('');
      reloadTable();
      loadPreview();
    } catch (err) {
      toast(err?.message || 'Could not send reminders.', { type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Session',
      render: (_, row) => textHtml(row.name),
    },
    {
      key: 'branchName',
      label: 'Branch',
      render: (_, row) => textHtml(row.branchName || 'All branches'),
    },
    {
      key: 'totalRecipients',
      label: 'Recipients',
      render: (_, row) => textHtml(String(row.totalRecipients ?? 0)),
    },
    {
      key: 'sentCount',
      label: 'Sent',
      render: (_, row) => textHtml(String(row.sentCount ?? 0)),
    },
    {
      key: 'clickedCount',
      label: 'Clicked',
      render: (_, row) => textHtml(String(row.clickedCount ?? 0)),
    },
    {
      key: 'submittedCount',
      label: 'Submitted',
      render: (_, row) => textHtml(String(row.submittedCount ?? 0)),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => statusHtml(row.status),
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (_, row) => dateHtml(row.sentAt || row.createdAt),
    },
  ], []);

  const ajaxParams = useMemo(() => ({
    search: appliedFilters.search,
  }), [appliedFilters.search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee reminders"
        subtitle="Email incomplete employees with a personal link to finish equipment reporting"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Employee reminders' },
        ]}
      />

      {canManage && (
        <Card title="Send reminder session" subtitle="Targets active employees missing phone, assigned devices, or both">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-700">Session name (optional)</span>
              <input
                className="w-full min-h-[44px] rounded-xl border border-navy-200 px-4 py-2.5 text-sm"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="March equipment follow-up"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-700">Branch filter</span>
              <select
                className="w-full min-h-[44px] rounded-xl border border-navy-200 px-4 py-2.5 text-sm"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  loadPreview(e.target.value);
                }}
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/50 p-4">
            <p className="text-sm font-medium text-cyan-900">
              {previewLoading ? 'Checking recipients…' : `${preview?.count ?? 0} employee(s) will receive a personalized email`}
            </p>
            {preview?.sample?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-navy-600">
                {preview.sample.map((item) => (
                  <li key={item.id}>
                    {item.fullName} · {item.branchName} · missing: {item.missing.join(', ')}
                  </li>
                ))}
                {(preview.count ?? 0) > preview.sample.length && (
                  <li className="text-navy-400">…and {preview.count - preview.sample.length} more</li>
                )}
              </ul>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <LoadingButton
              type="button"
              loading={sending}
              disabled={!preview?.count || previewLoading}
              onClick={handleSend}
              className="inline-flex items-center gap-2"
            >
              <Send size={16} />
              Send reminder emails
            </LoadingButton>
          </div>
        </Card>
      )}

      <ListSearchFilters
        values={filters}
        onChange={setFilters}
        onApply={setAppliedFilters}
        onClear={() => {
          const cleared = emptySearchFilters();
          setFilters(cleared);
          setAppliedFilters(cleared);
        }}
        placeholder="Search session or branch..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/reminders/sessions"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No reminder sessions yet"
          getRowHref={(row) => `/admin/employee-reminders/${row.id}`}
          tableKey={`employee-reminders-${appliedFilters.search}`}
        />
      </Card>

      {!canManage && (
        <Card>
          <p className="text-sm text-navy-500 flex items-center gap-2">
            <Mail size={16} />
            You can view reminder sessions. Sending requires employee manage permission.
          </p>
        </Card>
      )}
    </div>
  );
}
