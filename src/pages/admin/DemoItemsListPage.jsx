import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { PageHeader, DataTable, Card, ListSearchFilters, emptySearchFilters } from '../../components/ui';
import { productStatusHtml, textHtml, qtyHtml, dateHtml, currencyHtml, branchCodeHtml, employeeCodeHtml } from '../../utils/datatableHelpers';

export default function DemoItemsListPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);

  const pageTitle = useMemo(() => {
    if (statusFilter === 'low_stock') return 'Low Stock Products';
    if (statusFilter === 'out_of_stock') return 'Out of Stock Products';
    return 'Products';
  }, [statusFilter]);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const columns = [
    {
      key: 'sku',
      label: 'S/N',
      render: (_, row) => textHtml(row.sku),
    },
    {
      key: 'name',
      label: 'Name',
      render: (_, row) => textHtml(row.name),
    },
    { key: 'category', label: 'Type' },
    {
      key: 'brandName',
      label: 'Brand',
      render: (_, row) => textHtml(row.brandName),
    },
    {
      key: 'employeeName',
      label: 'Assigned to',
      render: (_, row) => employeeCodeHtml(row.employeeCode, row.employeeName),
    },
    {
      key: 'branchName',
      label: 'Branch',
      render: (_, row) => branchCodeHtml(row.branchCode, row.branchName),
    },
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
  ];

  const ajaxParams = useMemo(() => ({
    search: appliedFilters.search,
    status: statusFilter,
  }), [appliedFilters.search, statusFilter]);

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle="Product catalog with live stock levels"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: pageTitle },
        ]}
        actions={(
          <Link
            to="/admin/items/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add product
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
        placeholder="Search S/N, name, category, employee, or branch..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/items"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No products found"
          getRowHref={(row) => `/admin/items/${row.id}`}
          tableKey={`products-${statusFilter}-${appliedFilters.search}`}
        />
      </Card>
    </div>
  );
}
