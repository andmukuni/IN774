import { formatDate, formatZmw } from './helpers';

const STATUS_LABELS = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  discontinued: 'Discontinued',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function productStatusHtml(status) {
  const key = String(status || 'in_stock').toLowerCase();
  const label = STATUS_LABELS[key] || key.replace(/_/g, ' ');
  const badgeClass = key === 'low_stock' ? 'submitted' : key === 'out_of_stock' ? 'cancelled' : key === 'discontinued' ? 'draft' : 'processed';
  return `<span class="dt-badge dt-badge-${badgeClass}">${escapeHtml(label)}</span>`;
}

export function skuHtml(sku, name) {
  const code = escapeHtml(sku || '—');
  const title = escapeHtml(name || '');
  const sub = title ? `<div class="dt-subtext">${title}</div>` : '';
  return `<div class="dt-payee"><div class="dt-payee-primary">${code}</div>${sub}</div>`;
}

export function qtyHtml(quantity, reorderLevel) {
  const qty = Number(quantity);
  const reorder = Number(reorderLevel);
  const formatted = Number.isFinite(qty) ? qty.toLocaleString() : '0';
  const warn = Number.isFinite(qty) && Number.isFinite(reorder) && qty > 0 && qty <= reorder;
  const cls = warn ? ' style="color:#d97706;font-weight:600"' : '';
  return `<span class="dt-amount"${cls}>${formatted}</span>`;
}

export function dateHtml(value) {
  return formatDate(value);
}

export function currencyHtml(value) {
  const formatted = formatZmw(value);
  if (!formatted) return '<span class="dt-amount">—</span>';
  return `<span class="dt-amount">${escapeHtml(formatted)}</span>`;
}

const BRANCH_STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
};

export function branchStatusHtml(status) {
  const key = String(status || 'active').toLowerCase();
  const label = BRANCH_STATUS_LABELS[key] || key;
  const badgeClass = key === 'active' ? 'processed' : 'draft';
  return `<span class="dt-badge dt-badge-${badgeClass}">${escapeHtml(label)}</span>`;
}

export function branchCodeHtml(code, name) {
  const primary = escapeHtml(code || '—');
  const sub = name ? `<div class="dt-subtext">${escapeHtml(name)}</div>` : '';
  return `<div class="dt-payee"><div class="dt-payee-primary">${primary}</div>${sub}</div>`;
}

export function contactHtml(phone, managerName) {
  const line1 = escapeHtml(phone || '—');
  const manager = String(managerName || '').trim();
  const sub = manager && manager !== '—'
    ? `<div class="dt-subtext">${escapeHtml(manager)}</div>`
    : '';
  return `<div class="dt-payee"><div class="dt-payee-primary">${line1}</div>${sub}</div>`;
}

export function textHtml(value) {
  return escapeHtml(value || '—');
}

const EMPLOYEE_STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
};

export function employeeStatusHtml(status) {
  const key = String(status || 'active').toLowerCase();
  const label = EMPLOYEE_STATUS_LABELS[key] || key;
  const badgeClass = key === 'active' ? 'processed' : 'draft';
  return `<span class="dt-badge dt-badge-${badgeClass}">${escapeHtml(label)}</span>`;
}

export function employeeCodeHtml(code, fullName) {
  const primary = escapeHtml(code || '—');
  const sub = fullName ? `<div class="dt-subtext">${escapeHtml(fullName)}</div>` : '';
  return `<div class="dt-payee"><div class="dt-payee-primary">${primary}</div>${sub}</div>`;
}
