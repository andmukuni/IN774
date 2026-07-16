function setMetaContent(selector, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return;

  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    if (selector.includes('property=')) {
      const match = selector.match(/property="([^"]+)"/);
      if (match) el.setAttribute('property', match[1]);
    } else {
      const match = selector.match(/name="([^"]+)"/);
      if (match) el.setAttribute('name', match[1]);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', trimmed);
}

export function applyPageBranding({ title, description, appUrl = '' } = {}) {
  const safeTitle = String(title || '').trim();
  const safeDescription = String(description || '').trim();

  if (safeTitle) {
    document.title = safeTitle;
    setMetaContent('meta[property="og:title"]', safeTitle);
  }

  if (safeDescription) {
    setMetaContent('meta[name="description"]', safeDescription);
    setMetaContent('meta[property="og:description"]', safeDescription);
  }

  if (appUrl) {
    setMetaContent('meta[property="og:url"]', String(appUrl).trim().replace(/\/$/, ''));
  }
}
