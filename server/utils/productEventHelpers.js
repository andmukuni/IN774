import crypto from 'crypto';

export const PRODUCT_EVENT_TYPES = {
  REGISTERED: 'registered',
  INTAKE: 'intake',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  BRANCH_LINKED: 'branch_linked',
  TRANSFERRED: 'transferred',
  UPDATED: 'updated',
};

const EVENT_LABELS = {
  registered: 'Registered in inventory',
  intake: 'Reported via branch intake',
  assigned: 'Assigned to employee',
  unassigned: 'Removed from employee',
  branch_linked: 'Linked to branch',
  transferred: 'Transferred',
  updated: 'Record updated',
};

export async function ensureProductEventsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_events (
      id VARCHAR(90) PRIMARY KEY,
      product_id VARCHAR(90) NOT NULL,
      event_type VARCHAR(40) NOT NULL,
      summary VARCHAR(500) NOT NULL DEFAULT '',
      details TEXT NULL,
      from_branch_id VARCHAR(90) NULL,
      to_branch_id VARCHAR(90) NULL,
      from_employee_id VARCHAR(90) NULL,
      to_employee_id VARCHAR(90) NULL,
      actor VARCHAR(60) NOT NULL DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_events_product (product_id),
      INDEX idx_product_events_created (created_at)
    )
  `);
}

function newEventId() {
  return `pev-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function employeeLabel(row) {
  if (!row) return null;
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  if (name && row.employee_code) return `${name} (${row.employee_code})`;
  return name || row.employee_code || null;
}

export async function logProductEvent(pool, {
  productId,
  eventType,
  summary,
  details = null,
  fromBranchId = null,
  toBranchId = null,
  fromEmployeeId = null,
  toEmployeeId = null,
  actor = 'system',
  createdAt = null,
}) {
  const id = newEventId();
  const params = [
    id,
    productId,
    eventType,
    String(summary || '').trim() || EVENT_LABELS[eventType] || 'Event',
    details,
    fromBranchId,
    toBranchId,
    fromEmployeeId,
    toEmployeeId,
    actor,
  ];

  if (createdAt) {
    await pool.query(
      `INSERT INTO product_events
       (id, product_id, event_type, summary, details, from_branch_id, to_branch_id, from_employee_id, to_employee_id, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...params, createdAt],
    );
  } else {
    await pool.query(
      `INSERT INTO product_events
       (id, product_id, event_type, summary, details, from_branch_id, to_branch_id, from_employee_id, to_employee_id, actor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    );
  }

  return id;
}

export async function fetchProductEvents(pool, productId) {
  const [rows] = await pool.query(
    `SELECT
       pe.id, pe.product_id, pe.event_type, pe.summary, pe.details, pe.actor, pe.created_at,
       pe.from_branch_id, pe.to_branch_id, pe.from_employee_id, pe.to_employee_id,
       fb.name AS from_branch_name, fb.code AS from_branch_code,
       tb.name AS to_branch_name, tb.code AS to_branch_code,
       fe.employee_code AS from_employee_code, fe.first_name AS from_employee_first_name, fe.last_name AS from_employee_last_name,
       te.employee_code AS to_employee_code, te.first_name AS to_employee_first_name, te.last_name AS to_employee_last_name
     FROM product_events pe
     LEFT JOIN branches fb ON fb.id = pe.from_branch_id
     LEFT JOIN branches tb ON tb.id = pe.to_branch_id
     LEFT JOIN employees fe ON fe.id = pe.from_employee_id
     LEFT JOIN employees te ON te.id = pe.to_employee_id
     WHERE pe.product_id = ?
     ORDER BY pe.created_at DESC, pe.id DESC`,
    [productId],
  );

  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    title: EVENT_LABELS[row.event_type] || row.event_type,
    summary: row.summary,
    details: row.details || null,
    actor: row.actor,
    createdAt: row.created_at,
    fromBranch: row.from_branch_name
      ? { id: row.from_branch_id, name: row.from_branch_name, code: row.from_branch_code }
      : null,
    toBranch: row.to_branch_name
      ? { id: row.to_branch_id, name: row.to_branch_name, code: row.to_branch_code }
      : null,
    fromEmployee: employeeLabel(row.from_employee_id ? {
      employee_code: row.from_employee_code,
      first_name: row.from_employee_first_name,
      last_name: row.from_employee_last_name,
    } : null),
    toEmployee: employeeLabel(row.to_employee_id ? {
      employee_code: row.to_employee_code,
      first_name: row.to_employee_first_name,
      last_name: row.to_employee_last_name,
    } : null),
  }));
}

export function buildProductArchitecture(product) {
  const isBranchAsset = Boolean(product.branchAssetId) && !product.employeeId;
  const isPrinter = String(product.category || '').toLowerCase() === 'printer';
  const placement = isBranchAsset || isPrinter ? 'branch' : 'employee';

  return {
    placement,
    network: {
      label: 'Goodfellow branch network',
      description: 'Corporate LAN / branch connectivity',
    },
    branch: product.branchId
      ? {
        id: product.branchId,
        code: product.branchCode,
        name: product.branchName,
      }
      : null,
    employee: product.employeeId
      ? {
        id: product.employeeId,
        code: product.employeeCode,
        name: product.employeeName,
      }
      : null,
    device: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      brandName: product.brandName,
      status: product.status,
    },
    connections: placement === 'branch'
      ? [
        { from: 'network', to: 'branch', label: 'LAN' },
        { from: 'branch', to: 'device', label: isPrinter ? 'Shared printer' : 'Branch asset' },
      ]
      : [
        { from: 'network', to: 'branch', label: 'LAN' },
        { from: 'branch', to: 'employee', label: 'Workstation' },
        { from: 'employee', to: 'device', label: 'Assigned device' },
      ],
  };
}

async function resolveContextLabels(pool, { branchId, employeeId }) {
  let branchName = null;
  let employeeName = null;

  if (branchId) {
    const [[branch]] = await pool.query('SELECT name FROM branches WHERE id = ? LIMIT 1', [branchId]);
    branchName = branch?.name || null;
  }

  if (employeeId) {
    const [[employee]] = await pool.query(
      'SELECT first_name, last_name, employee_code FROM employees WHERE id = ? LIMIT 1',
      [employeeId],
    );
    employeeName = employeeLabel(employee);
  }

  return { branchName, employeeName };
}

export async function logProductRegistration(pool, {
  productId,
  branchId = null,
  employeeId = null,
  actor = 'admin',
  eventType = PRODUCT_EVENT_TYPES.REGISTERED,
  summary = null,
}) {
  const { branchName, employeeName } = await resolveContextLabels(pool, { branchId, employeeId });

  let message = summary;
  if (!message) {
    if (employeeId && employeeName) {
      message = `Assigned to ${employeeName}${branchName ? ` at ${branchName}` : ''}`;
    } else if (branchId && branchName) {
      message = `Linked to branch ${branchName}`;
    } else {
      message = 'Added to inventory';
    }
  }

  return logProductEvent(pool, {
    productId,
    eventType,
    summary: message,
    toBranchId: branchId,
    toEmployeeId: employeeId,
    actor,
  });
}

export async function logProductAssignmentChange(pool, {
  productId,
  previous = {},
  next = {},
  actor = 'admin',
}) {
  const prevEmployeeId = previous.employeeId || null;
  const nextEmployeeId = next.employeeId || null;
  const prevBranchId = previous.branchId || null;
  const nextBranchId = next.branchId || null;

  const events = [];

  if (prevEmployeeId !== nextEmployeeId) {
    if (!prevEmployeeId && nextEmployeeId) {
      const { employeeName, branchName } = await resolveContextLabels(pool, {
        employeeId: nextEmployeeId,
        branchId: nextBranchId,
      });
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.ASSIGNED,
        summary: `Assigned to ${employeeName || 'employee'}${branchName ? ` (${branchName})` : ''}`,
        toEmployeeId: nextEmployeeId,
        toBranchId: nextBranchId,
        actor,
      }));
    } else if (prevEmployeeId && !nextEmployeeId) {
      const { employeeName } = await resolveContextLabels(pool, { employeeId: prevEmployeeId });
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.UNASSIGNED,
        summary: `Removed from ${employeeName || 'employee'}`,
        fromEmployeeId: prevEmployeeId,
        actor,
      }));
    } else {
      const { employeeName: fromName } = await resolveContextLabels(pool, { employeeId: prevEmployeeId });
      const { employeeName: toName, branchName } = await resolveContextLabels(pool, {
        employeeId: nextEmployeeId,
        branchId: nextBranchId,
      });
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.TRANSFERRED,
        summary: `Moved from ${fromName || 'previous employee'} to ${toName || 'new employee'}`,
        fromEmployeeId: prevEmployeeId,
        toEmployeeId: nextEmployeeId,
        toBranchId: nextBranchId,
        details: branchName ? `Branch: ${branchName}` : null,
        actor,
      }));
    }
  }

  if (prevBranchId !== nextBranchId && !prevEmployeeId && !nextEmployeeId) {
    const { branchName: fromBranch } = await resolveContextLabels(pool, { branchId: prevBranchId });
    const { branchName: toBranch } = await resolveContextLabels(pool, { branchId: nextBranchId });
    if (!nextBranchId) {
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.UNASSIGNED,
        summary: `Removed from branch ${fromBranch || 'assignment'}`,
        fromBranchId: prevBranchId,
        actor,
      }));
    } else if (!prevBranchId) {
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.BRANCH_LINKED,
        summary: `Linked to branch ${toBranch || 'branch'}`,
        toBranchId: nextBranchId,
        actor,
      }));
    } else {
      events.push(logProductEvent(pool, {
        productId,
        eventType: PRODUCT_EVENT_TYPES.TRANSFERRED,
        summary: `Moved from ${fromBranch || 'previous branch'} to ${toBranch || 'new branch'}`,
        fromBranchId: prevBranchId,
        toBranchId: nextBranchId,
        actor,
      }));
    }
  }

  await Promise.all(events);
}

export async function backfillProductEvents(pool) {
  const [products] = await pool.query(
    `SELECT
       p.id, p.updated_at, p.employee_id, p.branch_id,
       b.id AS resolved_branch_id,
       e.first_name, e.last_name, e.employee_code,
       b.name AS branch_name
     FROM products p
     LEFT JOIN employees e ON e.id = p.employee_id
     LEFT JOIN branches b ON b.id = COALESCE(p.branch_id, e.branch_id)
     WHERE NOT EXISTS (
       SELECT 1 FROM product_events pe WHERE pe.product_id = p.id
     )`,
  );

  for (const product of products) {
    let summary = 'Initial inventory record';
    const employeeName = employeeLabel(product);
    if (product.employee_id && employeeName) {
      summary = `Assigned to ${employeeName}${product.branch_name ? ` at ${product.branch_name}` : ''}`;
    } else if (product.branch_id && product.branch_name) {
      summary = `Linked to branch ${product.branch_name}`;
    }

    await logProductEvent(pool, {
      productId: product.id,
      eventType: PRODUCT_EVENT_TYPES.REGISTERED,
      summary,
      toBranchId: product.resolved_branch_id || product.branch_id || null,
      toEmployeeId: product.employee_id || null,
      actor: 'system',
      createdAt: product.updated_at,
    });
  }

  if (products.length) {
    console.log(`[inventory] Product events backfilled: ${products.length}`);
  }
}
