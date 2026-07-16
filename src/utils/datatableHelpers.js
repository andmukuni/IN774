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

const ICON_EYE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

const ICON_PENCIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

const ICON_TRASH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

export function catalogRowActionsHtml(basePath, row, { canManage = false, canDelete = false, deleteLabel = '' } = {}) {
  const id = escapeHtml(String(row?.id || '').trim());
  if (!id) return '';

  const base = escapeHtml(String(basePath || '').replace(/\/$/, ''));
  const parts = [
    `<a href="${base}/${id}" class="dt-action-icon" title="View" aria-label="View">${ICON_EYE}</a>`,
  ];

  if (canManage) {
    parts.push(
      `<a href="${base}/${id}/edit" class="dt-action-icon dt-action-edit" title="Edit" aria-label="Edit">${ICON_PENCIL}</a>`,
    );
  }

  if (canDelete) {
    const label = escapeHtml(deleteLabel || row?.sku || row?.name || row?.code || 'this record');
    parts.push(
      `<button type="button" class="dt-action-icon dt-action-delete dt-row-delete" data-id="${id}" data-label="${label}" title="Delete" aria-label="Delete">${ICON_TRASH}</button>`,
    );
  }

  return `<div class="dt-actions">${parts.join('')}</div>`;
}
