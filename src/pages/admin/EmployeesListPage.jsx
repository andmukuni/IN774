import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, PlusCircle } from 'lucide-react';
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
  qtyHtml,
  textHtml,
} from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { useToast } from '../../context/ToastContext';
import { downloadAdminExport } from '../../utils/exportDownload';

export default function EmployeesListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees.manage');
  const canView = hasPermission('employees.view');
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');

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

  const handleExport = useCallback(async (format) => {
    if (!canView) return;
    setExportingFormat(format);
    try {
      await downloadAdminExport({
        path: '/admin/employees/export',
        params: {
          format,
          search: appliedFilters.search,
          status: statusFilter,
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
  }, [appliedFilters.search, canView, statusFilter, toast]);

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
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canView && (
              <div className="inline-flex overflow-hidden rounded-xl border border-navy-200 bg-white">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={Boolean(exportingFormat)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                >
                  <FileSpreadsheet size={15} />
                  {exportingFormat === 'csv' ? 'Exporting…' : 'CSV'}
                </button>
                <span className="w-px self-stretch bg-navy-200" />
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={Boolean(exportingFormat)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                >
                  <FileText size={15} />
                  {exportingFormat === 'pdf' ? 'Exporting…' : 'PDF'}
                </button>
              </div>
            )}
            {canManage ? (
              <Link
                to="/admin/employees/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
              >
                <PlusCircle size={16} />
                Add employee
              </Link>
            ) : null}
          </div>
        )}
      />

      <ListSearchFilters
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
        }}
        onClear={() => {
          const cleared = emptySearchFilters();
          setFilters(cleared);
          setAppliedFilters(cleared);
        }}
        placeholder="Search code, name, role, branch, email, or phone..."
      />

      {canView && (
        <div className="mb-4 flex items-center gap-2 text-xs text-navy-500">
          <Download size={14} />
          Exports include the current search and status filters.
        </div>
      )}

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
