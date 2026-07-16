import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ListSearchFilters,
  emptySearchFilters,
  ConfirmDialog,
} from '../../components/ui';
import {
  branchCodeHtml,
  catalogRowActionsHtml,
  contactHtml,
  dateHtml,
  employeeStatusHtml,
  textHtml,
} from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';

export default function EmployeesListPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const pageTitle = useMemo(() => {
    if (statusFilter === 'inactive') return 'Inactive Employees';
    if (statusFilter === 'active') return 'Active Employees';
    return 'Employees';
  }, [statusFilter]);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const deleteRecord = useDeleteRecord('/admin/employees', {
    successMessage: 'Employee deleted.',
  });

  const handleDeleteRequest = useCallback((id, label) => {
    setDeleteTarget({ id, label: label || 'this employee' });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteRecord(deleteTarget.id);
      setDeleteTarget(null);
      reloadTable();
    } catch {
      // Toast handled in hook; keep dialog open on failure.
    } finally {
      setDeleting(false);
    }
  }, [deleteRecord, deleteTarget, reloadTable]);

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
    search: appliedFilters.search,
    status: statusFilter,
  }), [appliedFilters.search, statusFilter]);

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

      <ListSearchFilters
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          reloadTable();
        }}
        onClear={() => {
          const cleared = emptySearchFilters();
          setFilters(cleared);
          setAppliedFilters(cleared);
          reloadTable();
        }}
        placeholder="Search code, name, role, branch, or email..."
      />

      <Card noPadding>
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
          tableKey={`employees-${statusFilter}-${appliedFilters.search}-${canManage ? 'manage' : 'view'}`}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete employee"
        message={`Delete ${deleteTarget?.label || 'this employee'}? Assigned products will be unlinked.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
