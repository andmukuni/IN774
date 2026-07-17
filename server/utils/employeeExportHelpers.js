import PDFDocument from 'pdfkit';

const EMPLOYEE_EXPORT_COLUMNS = [
  { key: 'employeeCode', label: 'Code' },
  { key: 'fullName', label: 'Name' },
  { key: 'jobTitle', label: 'Role' },
  { key: 'branchCode', label: 'Branch Code' },
  { key: 'branchName', label: 'Branch' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'assetsCount', label: 'Assets' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Updated' },
];

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatExportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function normalizeEmployeeExportRow(row = {}) {
  return {
    employeeCode: row.employeeCode || '',
    fullName: row.fullName || '',
    jobTitle: row.jobTitle || '',
    branchCode: row.branchCode || '',
    branchName: row.branchName || '',
    email: row.email || '',
    phone: row.phone || '',
    assetsCount: Number(row.assetsCount ?? 0),
    status: row.status || '',
    updatedAt: formatExportDate(row.updatedAt),
  };
}

export function buildEmployeesCsv(rows = [], { title = 'Employees' } = {}) {
  const normalized = rows.map(normalizeEmployeeExportRow);
  const header = EMPLOYEE_EXPORT_COLUMNS.map((col) => escapeCsvValue(col.label)).join(',');
  const body = normalized.map((row) => (
    EMPLOYEE_EXPORT_COLUMNS.map((col) => escapeCsvValue(row[col.key])).join(',')
  ));
  const meta = [
    `# ${title}`,
    `# Generated ${formatExportDate(new Date().toISOString())}`,
    `# Rows ${normalized.length}`,
    '',
  ];
  return `${[...meta, header, ...body].join('\n')}\n`;
}

function drawPdfTable(doc, rows, { title, subtitle }) {
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

  const colWidths = [52, 88, 68, 52, 78, 98, 62, 36, 44, 72];
  const rowHeight = 18;
  const headerHeight = 20;

  const drawHeader = () => {
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(8);
    EMPLOYEE_EXPORT_COLUMNS.forEach((col, index) => {
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
    EMPLOYEE_EXPORT_COLUMNS.forEach((col, index) => {
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

export function buildEmployeesPdfBuffer(rows = [], { title = 'Employees', subtitle = '' } = {}) {
  const normalized = rows.map(normalizeEmployeeExportRow);

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

    drawPdfTable(doc, normalized, { title, subtitle });
    doc.end();
  });
}

export function buildEmployeesExportFilename(format, { status = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = status ? `-${status}` : '';
  return `employees${suffix}-${stamp}.${format}`;
}
