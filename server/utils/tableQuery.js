/**
 * Parse pagination/sort/search from query string.
 * Supports simple page/limit and DataTables server-side processing params.
 */

export function parseTableQuery(query = {}, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const draw = query.draw != null ? Number(query.draw) : undefined;

  let limit = defaultLimit;
  let offset = 0;

  if (query.length != null || query.start != null) {
    limit = Math.min(maxLimit, Math.max(1, Number(query.length) || defaultLimit));
    offset = Math.max(0, Number(query.start) || 0);
  } else {
    limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
    const page = Math.max(1, Number(query.page) || 1);
    offset = (page - 1) * limit;
  }

  const search = String(
    query.search
    ?? query['search[value]']
    ?? query.q
    ?? '',
  ).trim();

  let sortColumn = null;
  let sortDir = 'desc';

  if (query.sort) {
    sortColumn = String(query.sort);
    sortDir = String(query.order || query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  } else if (query['order[0][column]'] != null) {
    sortColumn = String(query['order[0][column]']);
    sortDir = String(query['order[0][dir]'] || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  }

  const page = Math.floor(offset / limit) + 1;

  return {
    draw,
    limit,
    offset,
    page,
    search,
    sortColumn,
    sortDir,
  };
}

export function resolveSortColumn(sortColumn, columnMap, fallback = 'id') {
  const key = String(sortColumn ?? '').trim();
  if (key && columnMap[key]) return { sql: columnMap[key], dir: null };
  if (key && Object.values(columnMap).includes(key)) return { sql: key, dir: null };
  return { sql: columnMap[fallback] || fallback, dir: null };
}

export function buildOrderClause(sortColumn, sortDir, columnMap, fallback = 'id') {
  const index = sortColumn != null ? Number(sortColumn) : NaN;
  let sqlCol = columnMap[fallback] || fallback;

  if (!Number.isNaN(index)) {
    const keys = Object.keys(columnMap);
    if (keys[index]) sqlCol = columnMap[keys[index]];
  } else if (sortColumn && columnMap[sortColumn]) {
    sqlCol = columnMap[sortColumn];
  } else if (sortColumn && Object.values(columnMap).includes(sortColumn)) {
    sqlCol = sortColumn;
  }

  const dir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${sqlCol} ${dir}`;
}

export function buildPaginatedResponse(data, total, { page, limit, draw } = {}) {
  const safeTotal = Number(total) || 0;
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safePage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);

  const body = {
    ok: true,
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: safeTotal,
      totalPages,
    },
    recordsTotal: safeTotal,
    recordsFiltered: safeTotal,
  };

  if (draw != null) body.draw = Number(draw);
  return body;
}
