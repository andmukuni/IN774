import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ConfirmDialog,
  TableActionsMenu,
} from '../../components/ui';
import EmployeeListFilters, { emptyEmployeeFilters } from '../../components/admin/EmployeeListFilters';
import {
  branchCodeHtml,
  catalogRowActionsHtml,
  contactHtml,
  dateHtml,
  employeeStatusHtml,
  qtyHtml,
  textHtml,
} from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { useToast } from '../../context/ToastContext';
import { downloadAdminExport } from '../../utils/exportDownload';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

function buildInitialFilters(statusFromUrl = '') {
  const base = emptyEmployeeFilters();
  if (statusFromUrl) base.status = statusFromUrl;
  return base;
}

export default function EmployeesListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const canView = hasPermission('employees.view');
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const tableRef = useRef(null);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState(() => buildInitialFilters(statusFromUrl));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(statusFromUrl));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const selectedCount = selectedIds.size;

  useEffect(() => {
    const next = buildInitialFilters(statusFromUrl);
    setFilters(next);
    setAppliedFilters(next);
    setSelectedIds(new Set());
    tableRef.current?.clearSelection?.();
  }, [statusFromUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/branches?limit=100`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.ok) {
          setBranches(json.data || []);
        }
      } catch {
        if (!cancelled) toast('Unable to load branches.', { type: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const pageTitle = useMemo(() => {
    if (appliedFilters.status === 'inactive') return 'Inactive Employees';
    if (appliedFilters.status === 'active') return 'Active Employees';
    return 'Employees';
  }, [appliedFilters.status]);

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

  const deleteRecord = useDeleteRecord('/admin/employees', {
    successMessage: 'Employee deleted.',
  });

  const handleDeleteRequest = useCallback((id, label) => {
    setDeleteTarget({ mode: 'single', id, label: label || 'this employee' });
  }, []);

  const handleBulkDeleteRequest = useCallback(() => {
    if (!selectedCount) return;
    setDeleteTarget({ mode: 'bulk', count: selectedCount });
  }, [selectedCount]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.mode === 'bulk') {
        const res = await fetch(`${API_BASE}/admin/employees/bulk-delete`, {
          method: 'POST',
          headers: {
            ...getAdminAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to delete selected employees.');
        }
        toast(`${json.deleted || selectedCount} employee(s) deleted.`, { type: 'success' });
        clearSelection();
      } else if (deleteTarget.id) {
        await deleteRecord(deleteTarget.id);
      }
      setDeleteTarget(null);
      reloadTable();
    } catch (err) {
      toast(err?.message || 'Delete failed.', { type: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [clearSelection, deleteRecord, deleteTarget, reloadTable, selectedCount, selectedIds, toast]);

  const handleStatusRequest = useCallback((status) => {
    if (!selectedCount) return;
    setStatusTarget({ status, count: selectedCount });
  }, [selectedCount]);

  const handleStatusConfirm = useCallback(async () => {
    if (!statusTarget?.status) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees/bulk-status`, {
        method: 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: statusTarget.status,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to update employee status.');
      }
      toast(`${json.updated || selectedCount} employee(s) marked ${statusTarget.status}.`, { type: 'success' });
      setStatusTarget(null);
      clearSelection();
      reloadTable();
    } catch (err) {
      toast(err?.message || 'Status update failed.', { type: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  }, [clearSelection, reloadTable, selectedCount, selectedIds, statusTarget, toast]);

  const exportParams = useMemo(() => ({
    code: appliedFilters.code,
    name: appliedFilters.name,
    role: appliedFilters.role,
    branchId: appliedFilters.branchId,
    status: appliedFilters.status,
    ids: selectedCount ? Array.from(selectedIds).join(',') : '',
  }), [appliedFilters, selectedCount, selectedIds]);

  const handleExport = useCallback(async (format) => {
    if (!canView) return;
    setExportingFormat(format);
    try {
      await downloadAdminExport({
        path: '/admin/employees/export',
        params: {
          format,
          ...exportParams,
        },
        fallbackFilename: `employees.${format}`,
        errorMessage: `Failed to export employees as ${format.toUpperCase()}.`,
      });
      toast(`Employees exported as ${format.toUpperCase()}.`, { type: 'success' });
    } catch (err) {
      toast(err?.message || 'Export failed.', { type: 'error' });
    } finally {
      setExportingFormat('');
    }
  }, [canView, exportParams, toast]);

  const tableActions = useMemo(() => {
    const busy = Boolean(exportingFormat || deleting || updatingStatus);
    const items = [];

    if (canView) {
      items.push(
        {
          key: 'export-csv',
          label: exportingFormat === 'csv' ? 'Exporting CSV…' : 'Export CSV',
          disabled: busy,
          onClick: () => handleExport('csv'),
        },
        {
          key: 'export-pdf',
          label: exportingFormat === 'pdf' ? 'Exporting PDF…' : 'Export PDF',
          disabled: busy,
          onClick: () => handleExport('pdf'),
        },
      );
    }

    if (canManage) {
      items.push({ key: 'divider-manage', type: 'divider' });
      items.push(
        {
          key: 'status-active',
          label: 'Mark active',
          disabled: busy || !selectedCount,
          onClick: () => handleStatusRequest('active'),
        },
        {
          key: 'status-inactive',
          label: 'Mark inactive',
          disabled: busy || !selectedCount,
          onClick: () => handleStatusRequest('inactive'),
        },
        {
          key: 'delete',
          label: 'Delete selected',
          tone: 'danger',
          disabled: busy || !selectedCount,
          onClick: handleBulkDeleteRequest,
        },
      );
    }

    return items;
  }, [
    canManage,
    canView,
    deleting,
    exportingFormat,
    handleBulkDeleteRequest,
    handleExport,
    handleStatusRequest,
    selectedCount,
    updatingStatus,
  ]);

  const columns = useMemo(() => [
    {
      key: 'employeeCode',
      label: 'Code',
      render: (_, row) => textHtml(row.employeeCode),
    },
    {
      key: 'fullName',
      label: 'Name',
      render: (_, row) => textHtml(row.fullName),
    },
    { key: 'jobTitle', label: 'Role', render: (_, row) => textHtml(row.jobTitle) },
    {
      key: 'branchName',
      label: 'Branch',
      render: (_, row) => branchCodeHtml(row.branchCode, row.branchName),
    },
    {
      key: 'email',
      label: 'Contact',
      render: (_, row) => contactHtml(row.phone, row.email),
    },
    {
      key: 'assetsCount',
      label: 'Assets',
      render: (_, row) => qtyHtml(row.assetsCount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => employeeStatusHtml(row.status),
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
      render: (_, row) => catalogRowActionsHtml('/admin/employees', row, {
        canManage,
        canDelete: canManage,
        deleteLabel: row.fullName || row.employeeCode,
      }),
    },
  ], [canManage]);

  const ajaxParams = useMemo(() => ({
    code: appliedFilters.code,
    name: appliedFilters.name,
    role: appliedFilters.role,
    branchId: appliedFilters.branchId,
    status: appliedFilters.status,
  }), [appliedFilters]);

  const tableKey = useMemo(() => (
    `employees-${appliedFilters.code}-${appliedFilters.name}-${appliedFilters.role}-${appliedFilters.branchId}-${appliedFilters.status}-${canManage ? 'manage' : 'view'}`
  ), [appliedFilters, canManage]);

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle="Staff assigned to branches — products link to employees"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: pageTitle },
        ]}
        actions={canManage ? (
          <Link
            to="/admin/employees/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add employee
          </Link>
        ) : null}
      />

      <EmployeeListFilters
        values={filters}
        onChange={setFilters}
        branches={branches}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters('');
          setFilters(cleared);
          setAppliedFilters(cleared);
          clearSelection();
        }}
      />

      <Card
        noPadding
        actions={(canView || canManage) ? (
          <TableActionsMenu
            selectedCount={selectedCount}
            disabled={Boolean(exportingFormat || deleting || updatingStatus)}
            actions={tableActions}
          />
        ) : null}
      >
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/employees"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No employees found"
          getRowHref={(row) => `/admin/employees/${row.id}`}
          onRowDelete={canManage ? handleDeleteRequest : undefined}
          selectable={(canView || canManage) ? {
            idKey: 'id',
            selectedIds,
            onSelectionChange: handleSelectionChange,
            disabled: deleting || updatingStatus,
          } : null}
          tableKey={tableKey}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.mode === 'bulk' ? 'Delete selected employees' : 'Delete employee'}
        message={deleteTarget?.mode === 'bulk'
          ? `Delete ${deleteTarget.count} selected employee(s)? Assigned products will be unlinked.`
          : `Delete ${deleteTarget?.label || 'this employee'}? Assigned products will be unlinked.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => !updatingStatus && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
        title="Change employee status"
        message={`Mark ${statusTarget?.count || 0} selected employee(s) as ${statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
