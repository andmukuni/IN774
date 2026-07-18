import { useCallback, useEffect, useMemo, useState } from 'react';
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
  branchStatusHtml,
  catalogRowActionsHtml,
  contactHtml,
  dateHtml,
  qtyHtml,
  textHtml,
} from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useAdminTablePage } from '../../hooks/useAdminTablePage';
import {
  BRANCH_FILTER_FIELDS,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';

export default function BranchesListPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('branches.manage');
  const canView = hasPermission('branches.view');
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [filters, setFilters] = useState(() => buildInitialFilters(BRANCH_FILTER_FIELDS, { status: statusFromUrl }));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(BRANCH_FILTER_FIELDS, { status: statusFromUrl }));

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
    exportPath: '/admin/branches/export',
    exportFilename: 'branches',
    buildExportParams: (nextFilters, selectedIds) => buildListExportParams(nextFilters, selectedIds),
    bulkDeletePath: '/admin/branches/bulk-delete',
    bulkStatusPath: '/admin/branches/bulk-status',
    singleDeletePath: '/admin/branches',
    entityLabel: 'branch',
    entityLabelPlural: 'branches',
    singleDeleteSuccessMessage: 'Branch deleted.',
  });

  useEffect(() => {
    const next = buildInitialFilters(BRANCH_FILTER_FIELDS, { status: statusFromUrl });
    setFilters(next);
    setAppliedFilters(next);
    clearSelection();
  }, [clearSelection, statusFromUrl]);

  const pageTitle = useMemo(() => {
    if (appliedFilters.status === 'inactive') return 'Inactive Branches';
    if (appliedFilters.status === 'active') return 'Active Branches';
    return 'Branches';
  }, [appliedFilters.status]);

  const columns = useMemo(() => [
    {
      key: 'code',
      label: 'Code',
      render: (_, row) => branchCodeHtml(row.code, row.name),
    },
    { key: 'city', label: 'City', render: (_, row) => textHtml(row.city) },
    { key: 'address', label: 'Address', render: (_, row) => textHtml(row.address) },
    {
      key: 'phone',
      label: 'Contact',
      render: (_, row) => contactHtml(row.phone, row.managerName),
    },
    {
      key: 'assetsCount',
      label: 'Assets',
      render: (_, row) => qtyHtml(row.assetsCount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => branchStatusHtml(row.status),
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
      render: (_, row) => catalogRowActionsHtml('/admin/branches', row, {
        canManage,
        canDelete: canManage,
        deleteLabel: row.name || row.code,
      }),
    },
  ], [canManage]);

  const ajaxParams = useMemo(() => ({ ...appliedFilters }), [appliedFilters]);
  const tableKey = useMemo(
    () => `branches-${Object.values(appliedFilters).join('-')}-${canManage ? 'manage' : 'view'}`,
    [appliedFilters, canManage],
  );

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
        subtitle="Warehouse and retail branch locations"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: pageTitle },
        ]}
        actions={canManage ? (
          <Link
            to="/admin/branches/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add branch
          </Link>
        ) : null}
      />

      <DynamicListFilters
        fields={BRANCH_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(BRANCH_FILTER_FIELDS);
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
            disabled={busy}
            actions={tableActions}
          />
        ) : null}
      >
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/branches"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No branches found"
          getRowHref={(row) => `/admin/branches/${row.id}`}
          onRowDelete={canManage ? handleDeleteRequest : undefined}
          selectable={selectable}
          tableKey={tableKey}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.mode === 'bulk' ? 'Delete selected branches' : 'Delete branch'}
        message={deleteTarget?.mode === 'bulk'
          ? `Delete ${deleteTarget.count} selected branch(es)? Branches with employees will be skipped.`
          : `Delete ${deleteTarget?.label || 'this branch'}? Branches with employees cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => !updatingStatus && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
        title="Change branch status"
        message={`Mark ${statusTarget?.count || 0} selected branch(es) as ${statusTarget?.label || statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
