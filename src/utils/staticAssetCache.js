const STATIC_ASSET_CACHE = 'gfl-static-assets-v1';

/** Known long-lived public assets to warm in the browser Cache Storage layer. */
export const CACHED_STATIC_ASSETS = Object.freeze({
  loginHero: '/images/login-hero.webp',
});

/**
 * Ensure a public static asset is stored in Cache Storage for fast repeat loads.
 * Falls back silently when Cache API is unavailable.
 */
export async function warmStaticAsset(url) {
  const assetUrl = String(url || '').trim();
  if (!assetUrl || typeof caches === 'undefined') return false;

  try {
    const cache = await caches.open(STATIC_ASSET_CACHE);
    const hit = await cache.match(assetUrl);
    if (hit) return true;

    const response = await fetch(assetUrl, {
      cache: 'force-cache',
      credentials: 'same-origin',
    });
    if (!response.ok) return false;

    await cache.put(assetUrl, response.clone());
    return true;
  } catch {
    return false;
  }
}

export function warmLoginHeroAsset() {
  return warmStaticAsset(CACHED_STATIC_ASSETS.loginHero);
}
