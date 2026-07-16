import { useCallback, useMemo, useRef, useState } from 'react';
import { PageHeader, DataTable, Card, ListSearchFilters, emptySearchFilters } from '../../components/ui';
import { branchStatusHtml, dateHtml, textHtml } from '../../utils/datatableHelpers';

export default function BrandsListPage() {
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const columns = [
    { key: 'code', label: 'Code', render: (_, row) => textHtml(row.code) },
    { key: 'name', label: 'Brand', render: (_, row) => textHtml(row.name) },
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
  }), [appliedFilters.search]);

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Computer and electronics manufacturers (HP, Dell, Kyocera, etc.)"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: 'Brands' },
        ]}
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
        placeholder="Search brand code or name..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/brands"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No brands found"
          rowClickable={false}
          tableKey={`brands-${appliedFilters.search}`}
        />
      </Card>
    </div>
  );
}
