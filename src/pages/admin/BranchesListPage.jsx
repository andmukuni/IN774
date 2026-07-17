import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { PageHeader, DataTable, Card, ListSearchFilters, emptySearchFilters } from '../../components/ui';
import {
  branchCodeHtml,
  branchStatusHtml,
  contactHtml,
  dateHtml,
  qtyHtml,
  textHtml,
} from '../../utils/datatableHelpers';

export default function BranchesListPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);

  const pageTitle = useMemo(() => {
    if (statusFilter === 'inactive') return 'Inactive Branches';
    if (statusFilter === 'active') return 'Active Branches';
    return 'Branches';
  }, [statusFilter]);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const columns = [
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
  ];

  const ajaxParams = useMemo(() => ({
    search: appliedFilters.search,
    status: statusFilter,
  }), [appliedFilters.search, statusFilter]);

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
        actions={(
          <Link
            to="/admin/branches/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add branch
          </Link>
        )}
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
        placeholder="Search code, name, city, or manager..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/branches"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No branches found"
          getRowHref={(row) => `/admin/branches/${row.id}`}
          tableKey={`branches-${statusFilter}-${appliedFilters.search}`}
        />
      </Card>
    </div>
  );
}
