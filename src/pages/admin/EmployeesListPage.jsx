import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ConfirmDialog,
  DynamicListFilters,
  TableActionsMenu,
} from '../../components/ui';
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
import { useAdminTablePage } from '../../hooks/useAdminTablePage';
import {
  EMPLOYEE_FILTER_FIELDS,
  buildBranchOptions,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { useToast } from '../../context/ToastContext';

const API_BASE = getApiBase();

export default function EmployeesListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const canView = hasPermission('employees.view');
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState(() => buildInitialFilters(EMPLOYEE_FILTER_FIELDS, { status: statusFromUrl }));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(EMPLOYEE_FILTER_FIELDS, { status: statusFromUrl }));

  const {
    tableRef,
    selectedCount,
    clearSelection,
    deleting,
    updatingStatus,
    busy,
    deleteTarget,
    statusTarget,
    setDeleteTarget,
    setStatusTarget,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleStatusConfirm,
    buildTableActions,
    selectable,
  } = useAdminTablePage({
    canView,
    canManage,
    exportPath: '/admin/employees/export',
    exportFilename: 'employees',
    buildExportParams: (nextFilters, selectedIds) => buildListExportParams(nextFilters, selectedIds),
    bulkDeletePath: '/admin/employees/bulk-delete',
    bulkStatusPath: '/admin/employees/bulk-status',
    singleDeletePath: '/admin/employees',
    entityLabel: 'employee',
    entityLabelPlural: 'employees',
    singleDeleteSuccessMessage: 'Employee deleted.',
  });

  useEffect(() => {
    const next = buildInitialFilters(EMPLOYEE_FILTER_FIELDS, { status: statusFromUrl });
    setFilters(next);
    setAppliedFilters(next);
    clearSelection();
  }, [clearSelection, statusFromUrl]);

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

  const columns = useMemo(() => [
    { key: 'employeeCode', label: 'Code', render: (_, row) => textHtml(row.employeeCode) },
    { key: 'fullName', label: 'Name', render: (_, row) => textHtml(row.fullName) },
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
    { key: 'assetsCount', label: 'Assets', render: (_, row) => qtyHtml(row.assetsCount) },
    { key: 'status', label: 'Status', render: (_, row) => employeeStatusHtml(row.status) },
    { key: 'updatedAt', label: 'Updated', render: (_, row) => dateHtml(row.updatedAt) },
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

  const ajaxParams = useMemo(() => ({ ...appliedFilters }), [appliedFilters]);
  const filterOptions = useMemo(() => ({
    branches: buildBranchOptions(branches),
  }), [branches]);

  const tableActions = useMemo(() => buildTableActions({
    appliedFilters,
    statusActions: [
      { key: 'status-active', label: 'Mark active', status: 'active' },
      { key: 'status-inactive', label: 'Mark inactive', status: 'inactive' },
    ],
  }), [appliedFilters, buildTableActions]);

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

      <DynamicListFilters
        fields={EMPLOYEE_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        optionsMap={filterOptions}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(EMPLOYEE_FILTER_FIELDS);
          setFilters(cleared);
          setAppliedFilters(cleared);
          clearSelection();
        }}
      />

      <Card
        noPadding
        actions={(canView || canManage) ? (
          <TableActionsMenu selectedCount={selectedCount} disabled={busy} actions={tableActions} />
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
          selectable={selectable}
          tableKey={`employees-${Object.values(appliedFilters).join('-')}-${canManage ? 'manage' : 'view'}`}
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
        message={`Mark ${statusTarget?.count || 0} selected employee(s) as ${statusTarget?.label || statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
