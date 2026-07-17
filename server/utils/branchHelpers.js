export function mapBranchRow(row = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    managerName: row.manager_name,
    status: row.status || 'active',
    assetsCount: Number(row.assets_count ?? 0),
    updatedAt: row.updated_at,
  };
}
