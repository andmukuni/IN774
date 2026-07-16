export function mapProductTypeRow(row = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    status: row.status || 'active',
    updatedAt: row.updated_at,
  };
}
