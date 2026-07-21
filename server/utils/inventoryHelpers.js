/**
 * Product status and inventory helpers.
 */

export function computeProductStatus(quantity, reorderLevel, storedStatus = '') {
  if (String(storedStatus).toLowerCase() === 'discontinued') return 'discontinued';
  const qty = Number(quantity);
  const reorder = Number(reorderLevel);
  if (!Number.isFinite(qty) || qty <= 0) return 'out_of_stock';
  if (Number.isFinite(reorder) && qty <= reorder) return 'low_stock';
  return 'in_stock';
}

export function mapProductRow(row = {}) {
  const quantity = Number(row.quantity ?? 0);
  const reorderLevel = Number(row.reorder_level ?? 0);
  const status = computeProductStatus(quantity, reorderLevel, row.status);
  const firstName = row.employee_first_name || '';
  const lastName = row.employee_last_name || '';
  const employeeName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const presenceOnlineStatus = row.presence_online_status
    ? String(row.presence_online_status).toLowerCase()
    : null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    brandId: row.brand_id || null,
    brandCode: row.brand_code || null,
    brandName: row.brand_name || null,
    branchAssetId: row.product_branch_id || null,
    quantity,
    reorderLevel,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    status,
    employeeId: row.employee_id || null,
    employeeCode: row.employee_code || null,
    employeeName: employeeName || null,
    branchId: row.branch_id || null,
    branchCode: row.branch_code || null,
    branchName: row.branch_name || null,
    updatedAt: row.updated_at,
    presenceOnlineStatus: presenceOnlineStatus === 'online' || presenceOnlineStatus === 'offline'
      ? presenceOnlineStatus
      : null,
    presenceLastHeartbeatAt: row.presence_last_heartbeat_at
      ? new Date(row.presence_last_heartbeat_at).toISOString()
      : null,
    presenceStatusChangedAt: row.presence_status_changed_at
      ? new Date(row.presence_status_changed_at).toISOString()
      : null,
  };
}

export const PRODUCT_JOIN_SQL = `
  LEFT JOIN employees e ON e.id = p.employee_id
  LEFT JOIN branches b ON b.id = COALESCE(p.branch_id, e.branch_id)
  LEFT JOIN brands br ON br.id = p.brand_id
`;

export const PRODUCT_SELECT_FIELDS = `
  p.id, p.sku, p.name, p.category, p.brand_id, p.branch_id AS product_branch_id, p.quantity, p.reorder_level, p.unit_price, p.status, p.employee_id, p.updated_at,
  br.code AS brand_code, br.name AS brand_name,
  e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name,
  b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
  (
    SELECT dp.online_status
    FROM device_presence dp
    WHERE dp.product_id = p.id
       OR (dp.serial_number <> '' AND dp.serial_number = p.sku)
    ORDER BY (dp.product_id = p.id) DESC, dp.last_heartbeat_at DESC
    LIMIT 1
  ) AS presence_online_status,
  (
    SELECT dp.last_heartbeat_at
    FROM device_presence dp
    WHERE dp.product_id = p.id
       OR (dp.serial_number <> '' AND dp.serial_number = p.sku)
    ORDER BY (dp.product_id = p.id) DESC, dp.last_heartbeat_at DESC
    LIMIT 1
  ) AS presence_last_heartbeat_at,
  (
    SELECT dp.status_changed_at
    FROM device_presence dp
    WHERE dp.product_id = p.id
       OR (dp.serial_number <> '' AND dp.serial_number = p.sku)
    ORDER BY (dp.product_id = p.id) DESC, dp.last_heartbeat_at DESC
    LIMIT 1
  ) AS presence_status_changed_at
`;

