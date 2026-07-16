import StatusBadge from './StatusBadge';
import { formatDate, formatZmw } from '../../utils/helpers';

function DetailValue({ field, record }) {
  if (!record) return <span className="text-navy-400">—</span>;
  const value = record[field.key];
  if (field.render) return field.render(value, record);
  if (value == null || value === '') return <span className="text-navy-400">—</span>;
  return <span>{String(value)}</span>;
}

export default function RecordDetailView({ record, fields = [] }) {
  if (!record) return null;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {fields.map((field) => (
        <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
          <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">
            {field.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-navy-900">
            <DetailValue field={field} record={record} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const productDetailFields = [
  { key: 'sku', label: 'S/N' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Product type' },
  {
    key: 'brandName',
    label: 'Brand',
    render: (value) => value || '—',
  },
  {
    key: 'quantity',
    label: 'Quantity',
    render: (value, row) => `${Number(value ?? 0).toLocaleString()} (reorder at ${Number(row.reorderLevel ?? 0).toLocaleString()})`,
  },
  {
    key: 'unitPrice',
    label: 'Price (K)',
    render: (value) => formatZmw(value) ?? '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    key: 'employeeName',
    label: 'Assigned employee',
    render: (value, row) => {
      if (!value) return '—';
      return row.employeeCode ? `${row.employeeCode} — ${value}` : value;
    },
  },
  {
    key: 'branchName',
    label: 'Branch',
    render: (value, row) => {
      if (!value) return '—';
      return row.branchCode ? `${row.branchCode} — ${value}` : value;
    },
  },
  {
    key: 'updatedAt',
    label: 'Last updated',
    render: (value) => formatDate(value),
  },
];

export const brandDetailFields = [
  { key: 'code', label: 'Brand code' },
  { key: 'name', label: 'Name' },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    key: 'updatedAt',
    label: 'Last updated',
    render: (value) => formatDate(value),
  },
];

export const productTypeDetailFields = [
  { key: 'code', label: 'Type code' },
  { key: 'name', label: 'Name' },
  {
    key: 'description',
    label: 'Description',
    fullWidth: true,
    render: (value) => value || '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    key: 'updatedAt',
    label: 'Last updated',
    render: (value) => formatDate(value),
  },
];

export const branchDetailFields = [
  { key: 'code', label: 'Branch code' },
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City' },
  { key: 'phone', label: 'Phone' },
  { key: 'managerName', label: 'Manager' },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    key: 'address',
    label: 'Address',
    fullWidth: true,
    render: (value) => value || '—',
  },
  {
    key: 'updatedAt',
    label: 'Last updated',
    render: (value) => formatDate(value),
  },
];

export const employeeDetailFields = [
  { key: 'employeeCode', label: 'Employee code' },
  { key: 'fullName', label: 'Full name' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  {
    key: 'branchName',
    label: 'Branch',
    render: (value, row) => {
      if (!value) return '—';
      return row.branchCode ? `${row.branchCode} — ${value}` : value;
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  {
    key: 'updatedAt',
    label: 'Last updated',
    render: (value) => formatDate(value),
  },
];

export const userDetailFields = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  {
    key: 'email_verified',
    label: 'Email verified',
    render: (value) => <StatusBadge status={value ? 'confirmed' : 'pending'} />,
  },
  {
    key: 'created_at',
    label: 'Joined',
    render: (value) => formatDate(value),
  },
];
