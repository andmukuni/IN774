import PDFDocument from 'pdfkit';

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatExportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function buildTableCsv(columns = [], rows = [], { title = 'Export' } = {}) {
  const header = columns.map((col) => escapeCsvValue(col.label)).join(',');
  const body = rows.map((row) => columns.map((col) => escapeCsvValue(row[col.key])).join(','));
  const meta = [
    `# ${title}`,
    `# Generated ${formatExportDate(new Date().toISOString())}`,
    `# Rows ${rows.length}`,
    '',
  ];
  return `${[...meta, header, ...body].join('\n')}\n`;
}

function drawPdfTable(doc, columns, rows, { title, subtitle }) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  let y = doc.page.margins.top;

  doc.font('Helvetica-Bold').fontSize(16).text(title, startX, y, { width: pageWidth });
  y += 22;
  if (subtitle) {
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(subtitle, startX, y, { width: pageWidth });
    y += 16;
  }
  doc.fillColor('#0f172a');

  const totalWeight = columns.reduce((sum, col) => sum + (col.width || 1), 0);
  const colWidths = columns.map((col) => ((col.width || 1) / totalWeight) * pageWidth);
  const rowHeight = 18;
  const headerHeight = 20;

  const drawHeader = () => {
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(8);
    columns.forEach((col, index) => {
      doc.rect(x, y, colWidths[index], headerHeight).fillAndStroke('#ecfeff', '#cbd5e1');
      doc.fillColor('#0f172a').text(col.label, x + 4, y + 5, {
        width: colWidths[index] - 8,
        height: headerHeight - 6,
        ellipsis: true,
      });
      x += colWidths[index];
    });
    y += headerHeight;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(7.5);

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ layout: 'landscape', size: 'A4', margin: 36 });
      y = doc.page.margins.top;
      drawHeader();
      doc.font('Helvetica').fontSize(7.5);
    }

    let x = startX;
    const fill = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
    columns.forEach((col, index) => {
      doc.rect(x, y, colWidths[index], rowHeight).fillAndStroke(fill, '#e2e8f0');
      doc.fillColor('#0f172a').text(String(row[col.key] ?? ''), x + 4, y + 4, {
        width: colWidths[index] - 8,
        height: rowHeight - 6,
        ellipsis: true,
      });
      x += colWidths[index];
    });
    y += rowHeight;
  });
}

export function buildTablePdfBuffer(columns = [], rows = [], { title = 'Export', subtitle = '' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: {
        Title: title,
        Author: 'Goodfellow Inventory',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawPdfTable(doc, columns, rows, { title, subtitle });
    doc.end();
  });
}

export function buildExportFilename(base, format, { suffix = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}${suffix ? `-${suffix}` : ''}-${stamp}.${format}`;
}

export function buildExportSubtitle(filters = {}, count = 0) {
  const parts = [];
  if (filters.ids?.length) parts.push(`${filters.ids.length} selected`);
  Object.entries(filters).forEach(([key, value]) => {
    if (!value || key === 'ids' || key === 'search') return;
    parts.push(`${key}: ${value}`);
  });
  if (filters.search) parts.push(`Search: ${filters.search}`);
  parts.push(`${count} record(s)`);
  return parts.join(' · ');
}

export const BRANCH_EXPORT_COLUMNS = [
  { key: 'code', label: 'Code', width: 1 },
  { key: 'name', label: 'Name', width: 1.4 },
  { key: 'city', label: 'City', width: 1 },
  { key: 'address', label: 'Address', width: 1.6 },
  { key: 'phone', label: 'Phone', width: 1 },
  { key: 'managerName', label: 'Manager', width: 1.2 },
  { key: 'assetsCount', label: 'Assets', width: 0.7 },
  { key: 'status', label: 'Status', width: 0.8 },
  { key: 'updatedAt', label: 'Updated', width: 1.2 },
];

export const PRODUCT_EXPORT_COLUMNS = [
  { key: 'sku', label: 'S/N', width: 1 },
  { key: 'name', label: 'Name', width: 1.4 },
  { key: 'category', label: 'Type', width: 1 },
  { key: 'brandName', label: 'Brand', width: 1 },
  { key: 'employeeName', label: 'Assigned to', width: 1.2 },
  { key: 'branchName', label: 'Branch', width: 1.1 },
  { key: 'quantity', label: 'Qty', width: 0.6 },
  { key: 'unitPrice', label: 'Price (K)', width: 0.8 },
  { key: 'status', label: 'Status', width: 0.9 },
  { key: 'updatedAt', label: 'Updated', width: 1.2 },
];

export const BRAND_EXPORT_COLUMNS = [
  { key: 'code', label: 'Code', width: 1 },
  { key: 'name', label: 'Brand', width: 1.6 },
  { key: 'status', label: 'Status', width: 1 },
  { key: 'updatedAt', label: 'Updated', width: 1.2 },
];

export const PRODUCT_TYPE_EXPORT_COLUMNS = [
  { key: 'code', label: 'Code', width: 1 },
  { key: 'name', label: 'Type', width: 1.2 },
  { key: 'description', label: 'Description', width: 2 },
  { key: 'status', label: 'Status', width: 0.9 },
  { key: 'updatedAt', label: 'Updated', width: 1.2 },
];

export const REMINDER_EXPORT_COLUMNS = [
  { key: 'name', label: 'Session', width: 1.4 },
  { key: 'branchName', label: 'Branch', width: 1.2 },
  { key: 'totalRecipients', label: 'Recipients', width: 0.9 },
  { key: 'sentCount', label: 'Sent', width: 0.7 },
  { key: 'clickedCount', label: 'Clicked', width: 0.8 },
  { key: 'submittedCount', label: 'Submitted', width: 0.9 },
  { key: 'status', label: 'Status', width: 0.9 },
  { key: 'sentAt', label: 'Sent', width: 1.2 },
];

export function normalizeBranchExportRow(row = {}) {
  return {
    code: row.code || '',
    name: row.name || '',
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
    managerName: row.managerName || '',
    assetsCount: Number(row.assetsCount ?? 0),
    status: row.status || '',
    updatedAt: formatExportDate(row.updatedAt),
  };
}

export function normalizeProductExportRow(row = {}) {
  return {
    sku: row.sku || '',
    name: row.name || '',
    category: row.category || '',
    brandName: row.brandName || '',
    employeeName: row.employeeName || '',
    branchName: row.branchName || '',
    quantity: Number(row.quantity ?? 0),
    unitPrice: row.unitPrice != null ? Number(row.unitPrice).toFixed(2) : '',
    status: row.status || '',
    updatedAt: formatExportDate(row.updatedAt),
  };
}

export function normalizeBrandExportRow(row = {}) {
  return {
    code: row.code || '',
    name: row.name || '',
    status: row.status || '',
    updatedAt: formatExportDate(row.updatedAt),
  };
}

export function normalizeProductTypeExportRow(row = {}) {
  return {
    code: row.code || '',
    name: row.name || '',
    description: row.description || '',
    status: row.status || '',
    updatedAt: formatExportDate(row.updatedAt),
  };
}

const USER_EXPORT_COLUMNS = [
  { key: 'name', label: 'Name', width: 1.2 },
  { key: 'email', label: 'Email', width: 1.6 },
  { key: 'role', label: 'Role', width: 0.9 },
  { key: 'emailVerified', label: 'Verified', width: 0.8 },
  { key: 'createdAt', label: 'Joined', width: 1.2 },
];

export function normalizeUserExportRow(row = {}) {
  return {
    name: row.name || '',
    email: row.email || '',
    role: row.role || '',
    emailVerified: row.email_verified ? 'Yes' : 'No',
    createdAt: formatExportDate(row.created_at || row.createdAt),
  };
}

export function normalizeReminderExportRow(row = {}) {
  return {
    name: row.name || '',
    branchName: row.branchName || 'All branches',
    totalRecipients: Number(row.totalRecipients ?? 0),
    sentCount: Number(row.sentCount ?? 0),
    clickedCount: Number(row.clickedCount ?? 0),
    submittedCount: Number(row.submittedCount ?? 0),
    status: row.status || '',
    sentAt: formatExportDate(row.sentAt || row.createdAt),
  };
}

export { USER_EXPORT_COLUMNS };

export async function sendTableExport(res, {
  format,
  columns,
  rows,
  normalizeRow,
  title,
  subtitle,
  filename,
}) {
  const normalized = rows.map(normalizeRow);

  if (format === 'pdf') {
    const pdfBuffer = await buildTablePdfBuffer(columns, normalized, { title, subtitle });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  }

  if (format !== 'csv') {
    return res.status(400).json({ ok: false, message: 'Supported export formats are csv and pdf.' });
  }

  const csv = buildTableCsv(columns, normalized, { title });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${csv}`);
}
