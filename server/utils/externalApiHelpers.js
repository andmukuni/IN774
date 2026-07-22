import { mapProductRow, PRODUCT_JOIN_SQL, PRODUCT_SELECT_FIELDS } from './inventoryHelpers.js';
import { mapEmployeeRow } from './employeeHelpers.js';

export function mapExternalBranch(row) {
  if (!row?.branch_id && !row?.branch_code) return null;
  return {
    id: row.branch_id || null,
    code: row.branch_code || null,
    name: row.branch_name || null,
  };
}

export function mapExternalEmployeeSummary(row) {
  if (!row?.employee_id && !row?.employee_code) return null;
  const firstName = row.employee_first_name || row.first_name || '';
  const lastName = row.employee_last_name || row.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return {
    id: row.employee_id || row.id || null,
    employeeCode: row.employee_code || null,
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fullName || null,
    email: row.email || null,
    phone: row.phone || null,
    jobTitle: row.job_title || null,
    status: row.status || null,
    branch: mapExternalBranch({
      branch_id: row.branch_id,
      branch_code: row.branch_code,
      branch_name: row.branch_name,
    }),
  };
}

export function mapExternalAsset(row) {
  const product = mapProductRow(row);
  return {
    id: product.id,
    serialNumber: product.sku,
    name: product.name,
    category: product.category,
    brand: product.brandName ? {
      id: product.brandId,
      code: product.brandCode,
      name: product.brandName,
    } : null,
    status: product.status,
    quantity: product.quantity,
    branch: mapExternalBranch({
      branch_id: product.branchId,
      branch_code: product.branchCode,
      branch_name: product.branchName,
    }),
    employee: product.employeeId ? {
      id: product.employeeId,
      employeeCode: product.employeeCode,
      fullName: product.employeeName,
    } : null,
    updatedAt: product.updatedAt,
  };
}

export function mapExternalEmployee(row, { assetCount = null } = {}) {
  const employee = mapEmployeeRow(row);
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    status: employee.status,
    branch: mapExternalBranch({
      branch_id: employee.branchId,
      branch_code: employee.branchCode,
      branch_name: employee.branchName,
    }),
    assetCount: assetCount == null ? undefined : Number(assetCount),
    updatedAt: employee.updatedAt,
  };
}

export function mapExternalAssignment(row) {
  const asset = mapExternalAsset(row);
  return {
    assetId: asset.id,
    serialNumber: asset.serialNumber,
    assetName: asset.name,
    category: asset.category,
    employeeId: asset.employee?.id || null,
    employeeCode: asset.employee?.employeeCode || null,
    employeeName: asset.employee?.fullName || null,
    branchId: asset.branch?.id || null,
    branchCode: asset.branch?.code || null,
    branchName: asset.branch?.name || null,
    updatedAt: asset.updatedAt,
  };
}

export function mapExternalMonitorTarget(target) {
  if (!target) return null;
  return {
    id: target.id,
    name: target.name,
    type: target.type,
    hostOrUrl: target.hostOrUrl,
    port: target.port,
    path: target.path || '',
    enabled: Boolean(target.enabled),
    status: target.status || 'unknown',
    consecutiveFailures: Number(target.consecutiveFailures) || 0,
    lastCheckedAt: target.lastCheckedAt || null,
    lastLatencyMs: target.lastLatencyMs == null ? null : Number(target.lastLatencyMs),
    avgLatencyMs: target.avgLatencyMs == null ? null : Number(target.avgLatencyMs),
    lastError: target.lastError || null,
    intervalSeconds: Number(target.intervalSeconds) || null,
    timeoutMs: Number(target.timeoutMs) || null,
    speed: target.speed || null,
    traffic: target.traffic || null,
    updatedAt: target.updatedAt || null,
  };
}

export { PRODUCT_JOIN_SQL, PRODUCT_SELECT_FIELDS };
