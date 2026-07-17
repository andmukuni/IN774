import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Mail,
  Package,
  Phone,
  Boxes,
  Trash2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  DataTable,
  Spinner,
  StatusBadge,
  ConfirmDialog,
} from '../../components/ui';
import RecordShowActions from '../../components/admin/RecordShowActions';
import { useFetchRecord } from '../../hooks/useFetchRecord';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { formatDate } from '../../utils/helpers';
import {
  productStatusHtml,
  skuHtml,
  qtyHtml,
  dateHtml,
  currencyHtml,
  catalogRowActionsHtml,
} from '../../utils/datatableHelpers';

const API_BASE = getApiBase();

function profileInitials(firstName, lastName) {
  const parts = [firstName, lastName].map((s) => String(s || '').trim()[0]).filter(Boolean);
  return parts.join('').toUpperCase() || '?';
}

export default function EmployeeShowPage() {
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManageEmployees = hasPermission('employees.manage');
  const canManageItems = hasPermission('items.manage');
  const { record: profile, loading, error } = useFetchRecord('/admin/employees', id);
  const deleteEmployee = useDeleteRecord('/admin/employees', {
    redirectTo: '/admin/employees',
    successMessage: 'Employee deleted.',
  });
  const deleteItem = useDeleteRecord('/admin/items', {
    successMessage: 'Product deleted.',
  });

  const tableRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const ajaxParams = useMemo(() => ({ employeeId: id }), [id]);
  const selectedCount = selectedIds.size;

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    tableRef.current?.clearSelection?.();
  }, []);

  const handleSelectionChange = useCallback((next) => {
    setSelectedIds(next instanceof Set ? new Set(next) : new Set(next || []));
  }, []);

  const handleDeleteRequest = useCallback((itemId, label) => {
    setDeleteTarget({ mode: 'single', id: itemId, label: label || 'this product' });
  }, []);

  const handleBulkDeleteRequest = useCallback(() => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setDeleteTarget({
      mode: 'bulk',
      ids,
      label: `${ids.length} selected product${ids.length === 1 ? '' : 's'}`,
    });
  }, [selectedIds]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.mode === 'bulk') {
        const ids = deleteTarget.ids || [];
        let deleted = 0;
        let failed = 0;
        for (const itemId of ids) {
          const res = await fetch(`${API_BASE}/admin/items/${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
            headers: getAdminAuthHeaders(),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.ok) deleted += 1;
          else failed += 1;
        }

        if (deleted && !failed) {
          toast.success(`Deleted ${deleted} product${deleted === 1 ? '' : 's'}.`);
        } else if (deleted && failed) {
          toast.error(`Deleted ${deleted}, but ${failed} failed.`);
        } else {
          toast.error('Failed to delete selected products.');
          return;
        }

        setDeleteTarget(null);
        clearSelection();
        reloadTable();
        return;
      }

      if (!deleteTarget.id) return;
      await deleteItem(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(deleteTarget.id));
        return next;
      });
      reloadTable();
    } catch {
      // Toast handled in hook / above; keep dialog open on failure.
    } finally {
      setDeleting(false);
    }
  }, [clearSelection, deleteItem, deleteTarget, reloadTable, toast]);

  const assignedItemColumns = useMemo(() => [
    {
      key: 'sku',
      label: 'S/N',
      render: (_, row) => skuHtml(row.sku, row.name),
    },
    { key: 'category', label: 'Category' },
    {
      key: 'quantity',
      label: 'Qty',
      render: (_, row) => qtyHtml(row.quantity, row.reorderLevel),
    },
    {
      key: 'unitPrice',
      label: 'Price (K)',
      render: (_, row) => currencyHtml(row.unitPrice),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => productStatusHtml(row.status),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (_, row) => dateHtml(row.updatedAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      orderable: false,
      sortable: false,
      className: 'dt-right',
      render: (_, row) => catalogRowActionsHtml('/admin/items', row, {
        canManage: canManageItems,
        canDelete: canManageItems,
        deleteLabel: row.sku || row.name,
      }),
    },
  ], [canManageItems]);

  return (
    <div>
      <PageHeader
        title={profile?.fullName || 'Employee profile'}
        subtitle={profile?.employeeCode || 'Staff profile and assigned inventory'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Employees', to: '/admin/employees' },
          { label: profile?.employeeCode || 'Profile' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/employees"
            backLabel="Back to employees"
            editTo={canManageEmployees && id ? `/admin/employees/${id}/edit` : undefined}
            onDelete={canManageEmployees && id ? () => deleteEmployee(id) : undefined}
            deleteTitle="Delete employee"
            deleteMessage={`Delete ${profile?.fullName || 'this employee'}? Assigned products will be unlinked.`}
          />
        )}
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {!loading && error && (
        <Card title="Unable to load profile">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && profile && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-cyan-800 p-6 shadow-sm text-white">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold tracking-wide">
                  {profileInitials(profile.firstName, profile.lastName)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{profile.fullName}</h2>
                    <StatusBadge status={profile.status} />
                  </div>
                  <p className="mt-1 text-sm text-cyan-100/90">
                    {profile.employeeCode}
                    {profile.jobTitle ? ` · ${profile.jobTitle}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-navy-100">
                    {profile.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={14} />
                        {profile.email}
                      </span>
                    )}
                    {profile.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} />
                        {profile.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[220px]">
                <div className="rounded-xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cyan-100/80">Assigned items</p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
                    <Package size={16} />
                    {profile.stats?.assignedItems ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cyan-100/80">Units held</p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
                    <Boxes size={16} />
                    {(profile.stats?.totalUnits ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Profile" subtitle="Contact and role details">
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Employee code</dt>
                  <dd className="mt-1 text-sm font-medium text-navy-900">{profile.employeeCode}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Job title</dt>
                  <dd className="mt-1 text-sm font-medium text-navy-900">{profile.jobTitle || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Email</dt>
                  <dd className="mt-1 text-sm font-medium text-navy-900">{profile.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Phone</dt>
                  <dd className="mt-1 text-sm font-medium text-navy-900">{profile.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Last updated</dt>
                  <dd className="mt-1 text-sm font-medium text-navy-900">{formatDate(profile.updatedAt)}</dd>
                </div>
              </dl>
            </Card>

            <Card
              title="Branch"
              subtitle="Location this employee belongs to"
              actions={profile.branch?.id ? (
                <Link
                  to={`/admin/branches/${profile.branch.id}`}
                  className="text-xs font-medium text-cyan-600 hover:text-cyan-500"
                >
                  View branch
                </Link>
              ) : null}
            >
              {profile.branch ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">{profile.branch.name}</p>
                      <p className="text-sm text-navy-500">{profile.branch.code}</p>
                      {profile.branch.city && (
                        <p className="mt-2 text-sm text-navy-600">{profile.branch.city}</p>
                      )}
                    </div>
                    <StatusBadge status={profile.branch.status} />
                  </div>

                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Manager</dt>
                      <dd className="mt-1 text-sm text-navy-900">{profile.branch.managerName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Phone</dt>
                      <dd className="mt-1 text-sm text-navy-900">{profile.branch.phone || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Address</dt>
                      <dd className="mt-1 text-sm text-navy-900">{profile.branch.address || '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-navy-500">No branch assigned.</p>
              )}
            </Card>
          </div>

          <Card
            title="Assigned inventory"
            subtitle="Products linked to this employee"
            noPadding
            actions={canManageItems && selectedCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-navy-500">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-100"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            ) : null}
          >
            <DataTable
              ref={tableRef}
              columns={assignedItemColumns}
              serverSide
              ajaxUrl="/admin/items"
              ajaxParams={ajaxParams}
              pageLength={10}
              emptyTitle="No products assigned to this employee"
              getRowHref={(row) => `/admin/items/${row.id}`}
              onRowDelete={canManageItems ? handleDeleteRequest : undefined}
              selectable={canManageItems ? {
                idKey: 'id',
                selectedIds,
                onSelectionChange: handleSelectionChange,
                disabled: deleting,
              } : null}
              tableKey={`employee-items-${id}-${canManageItems ? 'manage' : 'view'}`}
            />
          </Card>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.mode === 'bulk' ? 'Delete selected products' : 'Delete product'}
        message={`Delete ${deleteTarget?.label || 'this product'}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
