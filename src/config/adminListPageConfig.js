export const STATUS_ACTIVE_INACTIVE = [
  { value: '', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const STATUS_PRODUCT = [
  { value: '', label: 'All status' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'discontinued', label: 'Discontinued' },
];

export const STATUS_REMINDER = [
  { value: '', label: 'All status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sending', label: 'Sending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export const EMPLOYEE_FILTER_FIELDS = [
  { key: 'code', type: 'text', placeholder: 'Code', weight: 0.85 },
  { key: 'name', type: 'text', placeholder: 'Name', weight: 1.1 },
  { key: 'role', type: 'text', placeholder: 'Role', weight: 0.85 },
  { key: 'branchId', type: 'select', placeholder: 'Branch', weight: 1.35, optionsKey: 'branches' },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.85, options: STATUS_ACTIVE_INACTIVE },
];

export const BRANCH_FILTER_FIELDS = [
  { key: 'code', type: 'text', placeholder: 'Code', weight: 0.85 },
  { key: 'name', type: 'text', placeholder: 'Name', weight: 1.1 },
  { key: 'city', type: 'text', placeholder: 'City', weight: 0.9 },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.85, options: STATUS_ACTIVE_INACTIVE },
];

export const PRODUCT_FILTER_FIELDS = [
  { key: 'sku', type: 'text', placeholder: 'S/N', weight: 0.8 },
  { key: 'name', type: 'text', placeholder: 'Name', weight: 1 },
  { key: 'category', type: 'text', placeholder: 'Type', weight: 0.85 },
  { key: 'brandId', type: 'select', placeholder: 'Brand', weight: 1, optionsKey: 'brands' },
  { key: 'branchId', type: 'select', placeholder: 'Branch', weight: 1.1, optionsKey: 'branches' },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.9, options: STATUS_PRODUCT },
];

export const BRAND_FILTER_FIELDS = [
  { key: 'code', type: 'text', placeholder: 'Code', weight: 0.9 },
  { key: 'name', type: 'text', placeholder: 'Brand', weight: 1.2 },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.9, options: STATUS_ACTIVE_INACTIVE },
];

export const PRODUCT_TYPE_FILTER_FIELDS = [
  { key: 'code', type: 'text', placeholder: 'Code', weight: 0.9 },
  { key: 'name', type: 'text', placeholder: 'Type', weight: 1.2 },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.9, options: STATUS_ACTIVE_INACTIVE },
];

export const REMINDER_FILTER_FIELDS = [
  { key: 'name', type: 'text', placeholder: 'Session', weight: 1.2 },
  { key: 'branchId', type: 'select', placeholder: 'Branch', weight: 1.2, optionsKey: 'branches' },
  { key: 'status', type: 'select', placeholder: 'Status', weight: 0.9, options: STATUS_REMINDER },
];

export const USER_FILTER_FIELDS = [
  { key: 'name', type: 'text', placeholder: 'Name', weight: 1.1 },
  { key: 'email', type: 'text', placeholder: 'Email', weight: 1.2 },
  { key: 'role', type: 'text', placeholder: 'Role', weight: 0.9 },
];

export function buildBranchOptions(branches = [], { allLabel = 'All branches' } = {}) {
  return [
    { value: '', label: allLabel },
    ...branches.map((branch) => ({
      value: branch.id,
      label: branch.code ? `${branch.code} · ${branch.name}` : branch.name,
    })),
  ];
}

export function buildBrandOptions(brands = []) {
  return [
    { value: '', label: 'All brands' },
    ...brands.map((brand) => ({
      value: brand.id,
      label: brand.code ? `${brand.code} · ${brand.name}` : brand.name,
    })),
  ];
}

export function buildListExportParams(filters, selectedIds) {
  const params = { ...filters };
  if (selectedIds?.size) {
    params.ids = Array.from(selectedIds).join(',');
  }
  return params;
}

export function buildInitialFilters(fields, urlValues = {}) {
  const base = fields.reduce((acc, field) => {
    acc[field.key] = urlValues[field.key] ?? '';
    return acc;
  }, {});
  return base;
}
