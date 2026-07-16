export function mapBrandRow(row = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status || 'active',
    updatedAt: row.updated_at,
  };
}
