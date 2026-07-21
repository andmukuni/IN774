#!/usr/bin/env node
/**
 * Generate GFL-Presence-Agent-Guide.pdf from the HTML template.
 * Usage: npm run docs:presence-pdf
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, '..', 'agent', 'docs');
const htmlPath = path.join(docsDir, 'GFL-Presence-Agent-Guide.html');
const pdfPath = path.join(docsDir, 'GFL-Presence-Agent-Guide.pdf');

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

if (!fs.existsSync(htmlPath)) {
  console.error('Missing HTML guide:', htmlPath);
  process.exit(1);
}

const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error('Chrome/Chromium not found. Open this file in a browser and Print → Save as PDF:');
  console.error(htmlPath);
  process.exit(1);
}

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'PDF generation failed.');
  process.exit(result.status || 1);
}

console.log('PDF created:', pdfPath);
