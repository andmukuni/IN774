import { readFile } from 'fs/promises';
import path from 'path';
import { getPublicSettings } from './systemSettingsHelpers.js';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveAppUrl() {
  return String(
    process.env.APP_URL
    || process.env.SERVICE_URL_GFL_INVENTORY
    || process.env.SERVICE_URL
    || '',
  ).trim().replace(/\/$/, '');
}

export async function getPageBranding() {
  const settings = await getPublicSettings();
  const companyName = String(settings.companyName || 'Goodfellow Inventory').trim();
  const description = String(
    settings.intakeIntroText
    || `Branch equipment intake and inventory — ${companyName}`,
  ).trim();

  return {
    title: companyName,
    description,
    appUrl: resolveAppUrl(),
  };
}

export function injectPageBranding(html, { title, description, appUrl = '' }) {
  const safeTitle = escapeAttr(title);
  const safeDescription = escapeAttr(description);
  const safeUrl = escapeAttr(appUrl);

  let next = String(html || '');

  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
  next = next.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDescription}" />`,
  );
  next = next.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`,
  );
  next = next.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDescription}" />`,
  );

  if (safeUrl) {
    if (/<meta property="og:url"/i.test(next)) {
      next = next.replace(
        /<meta property="og:url" content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${safeUrl}" />`,
      );
    } else {
      next = next.replace(
        /<meta property="og:type" content="website"\s*\/?>/i,
        `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${safeUrl}" />`,
      );
    }
  }

  return next;
}

let cachedIndexTemplate = null;
let cachedIndexPath = '';

export async function loadBrandedIndexHtml(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (cachedIndexPath !== indexPath || !cachedIndexTemplate) {
    cachedIndexTemplate = await readFile(indexPath, 'utf8');
    cachedIndexPath = indexPath;
  }

  const branding = await getPageBranding();
  return injectPageBranding(cachedIndexTemplate, branding);
}

export function clearIndexHtmlCache() {
  cachedIndexTemplate = null;
  cachedIndexPath = '';
}
