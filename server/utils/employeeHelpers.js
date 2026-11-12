export function mapEmployeeRow(row = {}) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
    email: row.email,
    phone: row.phone,
    jobTitle: row.job_title,
    branchId: row.branch_id,
    branchCode: row.branch_code || null,
    branchName: row.branch_name || null,
    status: row.status || 'active',
    assetsCount: Number(row.assets_count ?? 0),
    updatedAt: row.updated_at,
  };
}

export function toPublicEmployee(employee) {
  if (!employee) return null;
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    branchId: employee.branchId,
    branchName: employee.branchName,
    status: employee.status,
  };
}

export function mapPublicEmployeeRow(row = {}) {
  return toPublicEmployee(mapEmployeeRow(row));
}
